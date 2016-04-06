/**
 * Base class for managing display status of saved persons and relationships
 */
var Row = function(data){
  this.data = data;
  this.oldId = data.getId();
  this.newId = '';
  this.status = 'active';
  // callbacks are only fired once and new callbacks
  // are fired immediately if `fire()` has already been called
  this.savedCallbacks = $.Callbacks('once memory');
  this.$dom = $();
  this.render();
};

Row.prototype.render = function(){
  var $new = $(this.template(this.templateData()));
  this.$dom.replaceWith($new);
  this.$dom = $new;
};

Row.prototype.templateData = function(){
  return {};
};

Row.prototype.save = function(){
  
  var self = this;
  
  // Update row status to reflect that save is in progress
  self.status = 'info';
  self.render();
  
  // Copy data
  var newData = self.newData = this.copyData();
  
  // Remove ids because they are ids from production
  newData.clearIds();
  
  // Remove invalid facts. We check for the existence of getFacts()
  // because it doesn't exist on child and parent relationships; they have
  // mother facts and father facts.
  if(newData.getFacts){
    newData.getFacts().forEach(function(fact){
      if(!fact.getType()){
        console.log('removing fact with null type');
        newData.deleteFact(fact);
      }
    });
  }
  
  // Save
  var promise = newData.save();
  
  // Retrieve the new ID immediately so that notes and sources can use it
  promise.then(function(){
    self.newId = newData.getId();
  });
  
  // If we are saving notes or sources then wait for those promises, otherwise
  // wait on the person promise
  // If we want to save notes and sources then  we must wait until the
  // person has been copied into sandbox.
  promise = promise.then(function(){
    var attachments = [];
    if(Row.saveNotes){
      attachments.push(self.saveNotes());
    }
    if(Row.saveSources){
      attachments.push(self.saveSources());
    }
    return Promise.all(attachments);
  });
  
  promise.then(function(){
    self.status = 'success';
    self.render();
    self.savedCallbacks.fire();
  }).catch(function(e){
    self.status = 'danger';
    self.render();
    console.error(e.stack);
  });
  return promise;
};

Row.prototype.onSave = function(cb){
  this.savedCallbacks.add(cb);
};

Row.prototype.saveNotes = function(){
  var self = this;
  return this.data.getNotes().then(function(notesResponse){
    var notePromises = notesResponse.getNotes().map(function(prodNote){
      var sandboxNote = sandboxClient.createNote(prodNote.toJSON());
      sandboxNote.clearId();
      return sandboxNote.save(self.newData.getLink('notes').href);
    });
    return Promise.all(notePromises);
  });
};

/**
 * We have to process the sources serially to prevent concurrent updates to the
 * person (soruce refs), otherwise the server will respond with a 409.
 */
Row.prototype.saveSources = function(){
  var self = this;
  return this.data.getSources().then(function(sourcesResponse){
    var promise = Promise.resolve();
    sourcesResponse.getSourceDescriptions().forEach(function(prodSource){
      var sandboxSource = sandboxClient.createSourceDescription(prodSource.toJSON());
      sandboxSource.clearId();
      sandboxSource.data.links = {};
      promise = promise.then(function(){
        return self.newData.addSource(sandboxSource);
      });
    });
    return promise;
  });
};