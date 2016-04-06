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