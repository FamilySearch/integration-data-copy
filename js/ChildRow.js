/**
 * Child and parents relationship
 */
var ChildRow = function(data){
  var names = [];
  
  this.fatherRow = cache.persons[data.getFatherId()];
  if(this.fatherRow){
    names.push(this.fatherRow.data.getDisplayName());
  }
  this.motherRow = cache.persons[data.getMotherId()];
  if(this.motherRow){
    names.push(this.motherRow.data.getDisplayName());
  }
  this.childRow = cache.persons[data.getChildId()];
  names.push(this.childRow.data.getDisplayName());
  
  this.names = names.join(', ');
  
  Row.call(this, data);
  
  // When the persons in the relationship have both been saved
  // then add this relationship to the save queue
  var self = this;
  self.fatherSaved = false;
  self.motherSaved = false;
  self.childSaved = false;
  self.queued = false;
  
  if(self.fatherRow){
    self.fatherRow.onSave(function(){
      self.fatherSaved = true;
      self.prepareSave();
    });
  } else {
    self.fatherSaved = true;
  }
  
  if(self.motherRow){
    self.motherRow.onSave(function(){
      self.motherSaved = true;
      self.prepareSave();
    });
  } else {
    self.motherSaved = true;
  }
  
  self.childRow.onSave(function(){
    self.childSaved = true;
    self.prepareSave();
  });
};

ChildRow.prototype = Object.create(Row.prototype);

/**
 * Check that all persons have been saved.
 * Update person ids. Add to save queue.
 */
ChildRow.prototype.prepareSave = function(){
  if(this.fatherSaved && this.motherSaved && this.childSaved && !this.queued){
    this.queued = true;
    relationshipQueue.push(this);
  }
};

ChildRow.prototype.templateData = function(){
  return {
    productionId: this.oldId,
    sandboxId: this.newId,
    names: this.names,
    status: this.status
  };
};

ChildRow.prototype.copyData = function(){
  var newChild = sandboxClient.createChildAndParents(this.data.toJSON());
  newChild.setChild(this.childRow.newData);
  if(this.fatherRow){
    newChild.setFather(this.fatherRow.newData);
  }
  if(this.motherRow){
    newChild.setMother(this.motherRow.newData);
  }
  return newChild;
};

ChildRow.prototype.template = Handlebars.compile($('#child-row').html());