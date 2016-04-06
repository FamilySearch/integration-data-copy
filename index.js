// http://stackoverflow.com/a/3855394
var qs = (function(a) {
    if (a == "") return {};
    var b = {};
    for (var i = 0; i < a.length; ++i)
    {
        var p=a[i].split('=', 2);
        if (p.length == 1)
            b[p[0]] = "";
        else
            b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
    }
    return b;
})(window.location.search.substr(1).split('&'));

var productionClient = getFSClient('production'),
    sandboxClient = getFSClient('sandbox');
    
var cache = {
  persons: {},
  couples: {},
  children: {}
};

var personQueue = async.queue(queueWorker, 5),
    relationshipQueue = async.queue(queueWorker, 1);

function queueWorker(data, callback){
  data.save().then(function(){
    callback();
  }, function(e){
    console.error(e.stack);
    callback();
  });
}

$(function(){
  
  // Process query params
  if(qs.pid){
    $('#startPersonId').val(qs.pid);
  }
  if(qs.np){
    $('#numberPersons').val(qs.np);
  }
  if(qs.notes){
    $('#copyNotes').prop('checked', true);
  }
  if(qs.sources){
    $('#copySources').prop('checked', true);
  }
  
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
  Row.saveNotes = $('#copyNotes').is(':checked');
  Row.saveSources = $('#copySources').is(':checked');
      
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
    marriage.updateLinks();
    var row = new CoupleRow(marriage);
    $('#couple-table').append(row.$dom);
    cache.couples[marriage.getId()] = row;
  }
}

function processChild(child, mother, father, childRelationship){
  if(!child.isLiving() 
      && (!mother || !mother.isLiving()) 
      && (!father || !father.isLiving())){
    childRelationship.updateLinks();
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
      // redirect_uri: document.location.origin,
      environment: environment
    }, 
    token = Cookies.get(environment + '-token');
  if(token){
    config.access_token = token;
  }
  return new FamilySearch(config);
}

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

/**
 * Methods to set the notes and sources links on relationships because the
 * links don't exist when the relationships are returned by person with relationships
 * which is what fs-traversal uses.
 */
 
FamilySearch.Couple.prototype.updateLinks = function(){
  this.addLinks({
    notes: {
      href: this.getCoupleUrl() + '/notes'
    },
    'source-descriptions': {
      href: this.getCoupleUrl() + '/sources'
    }
  });
};

FamilySearch.ChildAndParents.prototype.updateLinks = function(){
  this.addLinks({
    notes: {
      href: this.getChildAndParentsUrl() + '/notes'
    },
    'source-descriptions': {
      href: this.getChildAndParentsUrl() + '/sources'
    }
  });
};