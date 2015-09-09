var productionClient = getFSClient('sandbox'),
    sandboxClient = getFSClient('sandbox');
    
var cache = {
  persons: {},
  couples: {},
  children: {}
};

var queue = async.queue(function(data, callback){
  data.save().then(function(){
    callback();
  }, function(e){
    callback();
  });
}, 5);

$(function(){
  
  initializeAuthentication();
  
  $('#start-search-btn').click(function(){
    var personId = $('#startPersonId').val().trim();
    if(!/^[A-Z0-9]+-[A-Z0-9]+$/.test(personId)){
      $('#start').addClass('has-error');
    } else {
      getStartPersonSummary(personId);
      $('#start').removeClass('has-error');
    }
  });
  
  // TODO: validation
  $('#copy-btn').click(copy);
  
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
  
  var limit = $('#numberPersons').val().trim();
  if(limit !== '' && parseInt(limit, 10)){
    traversal.limit(parseInt(limit, 10));
  }
  
  traversal.start($('#startPersonId').val().trim());
}

/**
 * Save the person. Create and update row in log table.
 */
function processPerson(person){
  var row = new PersonRow(person);
  $('#person-table').append(row.$dom);
  queue.push(row);
  cache.persons[person.getId()] = row;
}

function processMarriage(wife, husband, marriage){
  var row = new CoupleRow(marriage);
  $('#couple-table').append(row.$dom);
  cache.couples[marriage.getId()] = row;
}

function processChild(child, mother, father, childRelationship){
  
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
    $prodAuth.find('.auth').show();
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
    $sandboxAuth.find('.auth').show();
  }
}

/**
 * Get and display the start person's name and lifespan
 */
function getStartPersonSummary(personId){
  $('#start-search-btn').prop('disabled', true);
  $('#start-person-details .name').text('');
  $('#start-person-details .lifespan').text('');
  $('#start-person-details .error').html('');
  
  productionClient.getPerson(personId).then(function(response){
    $('#start-search-btn').prop('disabled', false);
    var person = response.getPerson();
    $('#start-person-details .name').text(person.getDisplayName());
    $('#start-person-details .lifespan').text(person.getDisplayLifeSpan());
  }).catch(function(){
    $('#start-search-btn').prop('disabled', false);
    $('#start-person-details .error').html('<div class="alert alert-danger">Unable to load person ' + personId + '.</div>');
  });
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
  self.data.client = sandboxClient;
  self.data.clearIds();
  self.status = 'info';
  self.render();
  
  var promise = self.data.save();
  promise.then(function(){
    self.status = 'success';
    self.newId = self.data.getId();
    self.render();
  }, function(e){
    self.status = 'danger';
    self.render();
    console.log(e.stack);
  });
  return promise;
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

PersonRow.prototype.template = Handlebars.compile($('#person-row').html());

/**
 * Couple Relationships
 */
var CoupleRow = function(couple){
  this.names = cache.persons[couple.getHusbandId()].data.getDisplayName() + ' and ' 
    + cache.persons[couple.getWifeId()].data.getDisplayName();
  Row.call(this, couple);
};

CoupleRow.prototype = Object.create(Row.prototype);

CoupleRow.prototype.templateData = function(){
  return {
    productionId: this.oldId,
    sandboxId: this.newId,
    names: this.names,
    status: this.status
  };
};

CoupleRow.prototype.template = Handlebars.compile($('#couple-row').html());

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