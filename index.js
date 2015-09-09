var productionClient = getFSClient('sandbox'),
    sandboxClient = getFSClient('sandbox');

$(function(){
  
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
  
});

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