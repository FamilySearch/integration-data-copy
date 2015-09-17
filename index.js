var productionClient = getFSClient('production'),
    sandboxClient = getFSClient('sandbox');
    
var cache = {
  persons: {},
  couples: {},
  children: {}
};

var personQueue = async.queue(queueWorker, 5);
var relationshipQueue = async.queue(queueWorker, 1);

function queueWorker(data, callback){
  data.save().then(function(){
    callback();
  }, function(e){
    console.error(e.stack);
    callback();
  });
}

$(function(){
  
  initializeAuthentication();
  
  // TODO: validation
  $('#copy-btn').click(function(){
    $(this).prop('disabled', true);
    copy();
  });
  
});

/**
 * Setup traversal and start copying
 */
function copy(){
  var traversal = FSTraversal(productionClient)
    .order('distance')
    .person(processPerson)
    .marriage(processMarriage)
    .child(processChild);
  
  var filter = $('input[name=traversal-filter]:checked').val();
  if(filter !== 'anyone'){
    traversal.filter(filter);
  }
  
  // parseInt will return NaN if an number wasn't found. We || with 5
  // to gaurantee that we end up with a number.
  var limit = parseInt($('#numberPersons').val().trim(), 10) || 5;
  
  // Enforce a maximum of 100
  limit = Math.min(limit, 100);
  
  traversal.limit(limit);
  traversal.start($('#startPersonId').val().trim());
}

/**
 * Save the person. Create and update row in log table.
 */
function processPerson(person){
  if(!person.isLiving()){
    var row = new PersonRow(person);
    $('#person-table').append(row.$dom);
    personQueue.push(row);
    cache.persons[person.getId()] = row;
  }
}

function processMarriage(wife, husband, marriage){
  if(!wife.isLiving() && !husband.isLiving()){
    var row = new CoupleRow(marriage);
    $('#couple-table').append(row.$dom);
    cache.couples[marriage.getId()] = row;
  }
}

function processChild(child, mother, father, childRelationship){
  if(!child.isLiving() 
      && (!mother || !mother.isLiving()) 
      && (!father || !father.isLiving())){
    var row = new ChildRow(childRelationship);
    $('#child-table').append(row.$dom);
    cache.children[childRelationship.getId()] = row;
  }
}

/**
 * Setup auth controls and events; detect the initial auth state.
 */
function initializeAuthentication(){
  var $prodAuth = $('#prod-auth').click(function(){
    productionClient.getAccessToken().then(function(token){
      $prodAuth.find('.no-auth').hide();
      $prodAuth.find('.auth').show();
      Cookies.set('production-token', token);
    });
  });
  
  if(productionClient.hasAccessToken()){
    $prodAuth.find('.no-auth').hide();
    $prodAuth.find('.verify').show();
    productionClient.getCurrentUser().then(function(){
      $prodAuth.find('.no-auth').hide();
      $prodAuth.find('.auth').show();
      $prodAuth.find('.verify').hide();
    }, function(){
      $prodAuth.find('.no-auth').show();
      $prodAuth.find('.auth').hide();
      $prodAuth.find('.verify').hide();
      Cookies.expire('production-token');
    });
  }
  
  var $sandboxAuth = $('#sandbox-auth').click(function(){
    sandboxClient.getAccessToken().then(function(token){
      $sandboxAuth.find('.no-auth').hide();
      $sandboxAuth.find('.auth').show();
      Cookies.set('sandbox-token', token);
    });
  });
  
  if(sandboxClient.hasAccessToken()){
    $sandboxAuth.find('.no-auth').hide();
    $sandboxAuth.find('.verify').show();
    sandboxClient.getCurrentUser().then(function(){
      $sandboxAuth.find('.no-auth').hide();
      $sandboxAuth.find('.auth').show();
      $sandboxAuth.find('.verify').hide();
    }, function(){
      $sandboxAuth.find('.no-auth').show();
      $sandboxAuth.find('.auth').hide();
      $sandboxAuth.find('.verify').hide();
      Cookies.expire('sandbox-token');
    });
  }
}

/**
 * Create an FS SDK client for the given environment.
 */
function getFSClient(environment){
  var config = {
      client_id: 'a02j00000098ve6AAA',
      redirect_uri: document.location.origin + '/',
      environment: environment
    }, 
    token = Cookies.get(environment + '-token');
  if(token){
    config.access_token = token;
  }
  return new FamilySearch(config);
}

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
  
  self.newData = this.copyData();
  
  self.newData.clearIds();
  self.status = 'info';
  self.render();
  
  var promise = self.newData.save();
  promise.then(function(){
    self.status = 'success';
    self.newId = self.newData.getId();
    self.render();
    self.savedCallbacks.fire();
  }, function(e){
    self.status = 'danger';
    self.render();
    console.error(e.stack);
  });
  return promise;
};

Row.prototype.onSave = function(cb){
  this.savedCallbacks.add(cb);
};

/**
 * Persons
 */
var PersonRow = function(person){
  Row.call(this, person);
};

PersonRow.prototype = Object.create(Row.prototype);

PersonRow.prototype.templateData = function(){
  return {
    productionId: this.oldId,
    sandboxId: this.newId,
    name: this.data.getDisplayName(),
    status: this.status
  };
};

PersonRow.prototype.copyData = function(){
  return sandboxClient.createPerson(this.data.toJSON());
};

PersonRow.prototype.template = Handlebars.compile($('#person-row').html());

/**
 * Couple Relationships
 */
var CoupleRow = function(couple){
  this.husbandRow = cache.persons[couple.getHusbandId()];
  this.wifeRow = cache.persons[couple.getWifeId()];
  this.names = this.husbandRow.data.getDisplayName() + ' and ' + this.wifeRow.data.getDisplayName();
  
  Row.call(this, couple);
  
  // When the persons in the relationship have both been saved
  // then add this relationship to the save queue
  var self = this;
  self.husbandSaved = false;
  self.wifeSaved = false;
  self.queued = false;
  self.husbandRow.onSave(function(){
    self.husbandSaved = true;
    self.prepareSave();
  });
  self.wifeRow.onSave(function(){
    self.wifeSaved = true;
    self.prepareSave();
  });
};

CoupleRow.prototype = Object.create(Row.prototype);

/**
 * Add to save queue when ready.
 */
CoupleRow.prototype.prepareSave = function(){
  if(this.husbandSaved && this.wifeSaved && !this.queued){
    this.queued = true;
    relationshipQueue.push(this);
  }
};

CoupleRow.prototype.templateData = function(){
  return {
    productionId: this.oldId,
    sandboxId: this.newId,
    names: this.names,
    status: this.status
  };
};

CoupleRow.prototype.copyData = function(){
  var newCouple = sandboxClient.createCouple(this.data.toJSON());
  newCouple.setHusband(this.husbandRow.newData);
  newCouple.setWife(this.wifeRow.newData);
  return newCouple;
};

CoupleRow.prototype.template = Handlebars.compile($('#couple-row').html());

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

/**
 * Reset internal IDs so that, when copying, the save function
 * thinks all names and facts are new.
 */

FamilySearch.BaseClass.prototype.clearId = function(){
  delete this.data.id;
};

FamilySearch.Person.prototype.clearIds = function(){
  this.clearId();
  this.getGender().clearId();
  
  var names = this.getNames();
  for(var i = 0; i < names.length; i++){
    names[i].clearId();
  }
  
  var facts = this.getFacts();
  for(var i = 0; i < facts.length; i++){
    facts[i].clearId();
  }
};

FamilySearch.Couple.prototype.clearIds = function(){
  this.clearId();
  
  // Whether a relationship is created or updated also depends on the presence
  // of the `relationship` link. So lets delete it.
  delete this.data.links.relationship;
  
  var facts = this.getFacts();
  for(var i = 0; i < facts.length; i++){
    facts[i].clearId();
  }
};

FamilySearch.ChildAndParents.prototype.clearIds = function(){
  this.clearId();
  
  // Whether a relationship is created or updated also depends on the presence
  // of the `relationship` link. So lets delete it.
  delete this.data.links.relationship;
  
  var fatherFacts = this.getFatherFacts();
  for(var i = 0; i < fatherFacts.length; i++){
    fatherFacts[i].clearId();
  }
  
  var motherFacts = this.getMotherFacts();
  for(var i = 0; i < motherFacts.length; i++){
    motherFacts[i].clearId();
  }
};