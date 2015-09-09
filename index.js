var productionClient = getFSClient('sandbox'),
    sandboxClient = getFSClient('sandbox');
    
var saved = {
  persons: {},
  couples: {},
  children: {}
};

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
  // Create log row
  var row = new PersonRow(person);
  $('#person-table').append(row.$dom);
  
  // Save
  // Update log row with saved status
}

function processMarriage(wife, husband, marriage){
  
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

var PersonRow = function(person){
  this.person = person;
  this.$dom = $();
  this.render();
};

PersonRow.prototype.render = function(){
  var $new = $(PersonRow.template({
    id: this.person.getId(),
    name: this.person.getDisplayName(),
    status: 'queued'
  }));
  this.$dom.replaceWith($new);
  this.$dom = $new;
};

PersonRow.template = Handlebars.compile($('#person-row').html());