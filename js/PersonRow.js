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