'use strict';
// ===============================
// The database factory provides
// the models to access the db
// entities available for the
// current environment
// ===============================

module.exports = function DbFactory(config, database){

  const
    Models = {} // The object to be returned by this factory
  ;

  // Depending on the configuration serve those models back
  const modelDir = __dirname + '/models';
  require('fs')
    .readdirSync(modelDir)
    .forEach(function(file) {
      if (file.match(/\.js$/) !== null && file !== 'index.js') {
        var model = require(modelDir + '/' + file)(database.conn, database.orm);
        Models[model.name] = model;
      }
    });

  Models._conn = database.conn; // Within the models expose the connection
  Models._orm  = database.orm; // Within the models expose the ORM

  Models.User.hasOne(Models.Partner)
  Models.User.hasOne(Models.Permission)
  Models.User.hasMany(Models.Passport)
  Models.User.hasMany(Models.FranchiseeRequest, {foreignKey:'user_id'});

  Models.Image.hasMany(Models.Partner, {foreignKey:'logo_id', as: 'Partners'})
  Models.Image.hasMany(Models.Franchise, {foreignKey:'logo_id', as: 'Franchises'})
  Models.Image.hasMany(Models.User, {foreignKey:'photo_id', as: 'User'})

  Models.Partner.hasMany(Models.Franchise)
  Models.Partner.belongsTo(Models.User)
  Models.Franchise.belongsTo(Models.Partner)

  const LogoOnPartner = Models.Partner.belongsTo( Models.Image, {foreignKey:'logo_id', as: 'Logo'});
  const LogoOnFranchise = Models.Franchise.belongsTo( Models.Image, {foreignKey:'logo_id', as: 'Logo'});
  const BannerImageOnFranchise = Models.Franchise.belongsTo( Models.Image, {foreignKey:'banner_image_id', as: 'BannerImage'});
  const AdditionalPhotosOnFranchise = Models.Franchise.hasMany(Models.Image, {foreignKey: 'assetable_id', as: 'AdditionalPhotos', constraints: false});
  const PhotoOnUser = Models.User.belongsTo( Models.Image, {foreignKey:'photo_id', as: 'Photo'});

  Models.Token.belongsTo(Models.User)
  Models.Passport.belongsTo(Models.User)


  Models.Franchise.hasMany(Models.FranchiseeRequest);
  Models.Franchise.hasMany(Models.FranchiseRegion, {constraints: false});
  Models.Franchise.hasMany(Models.FranchiseCategory, {constraints: false});
  Models.Franchise.hasOne(Models.SalesforceAccount, {constraints: false});
  Models.Franchise.belongsTo(Models.Industry, {foreignKey: 'industry'});
  Models.Franchise.belongsTo(Models.Investment_level, {foreignKey: 'investment_level_id'});
  Models.Franchise.belongsToMany(Models.Category, {through: Models.FranchiseCategory});
  Models.Franchise.belongsToMany(Models.User, {through: 'franchise_users'});
  Models.User.belongsToMany(Models.Franchise, {through: 'franchise_users'});
  Models.User.hasMany(Models.FranchiseUser);
  Models.Franchise.hasMany(Models.FranchiseUser);
  Models.Franchisee.belongsTo(Models.User, {foreignKey: 'user_id'});
  const TypeOnFranchise = Models.Franchise.belongsTo(Models.FranchiseType, {foreignKey: 'type_id', as: 'FranchiseType'});
  Models.FranchiseType.hasMany(Models.Franchise, {foreignKey: 'type_id', as: 'Franchises'});

  const htmlOnFranchise = Models.Franchise.belongsTo( Models.Html, {foreignKey:'htmls', as: 'Html'});
  Models.Html.hasMany(Models.Franchise, {foreignKey:'htmls', as: 'Franchises'})

  // Pages relations

  const HtmlResource = Models.Resource.hasOne(Models.Html, {foreignKey: 'resource_id', as: 'html'});
  const ExpertResource = Models.Resource.hasOne(Models.Expert, {foreignKey: 'resource_id', as: 'expert'})
  const VideoResource = Models.Resource.hasOne(Models.Video, {foreignKey: 'resource_id', as: 'video'})
  const HtmlAuthor = Models.Html.belongsTo(Models.Resource, {foreignKey: 'expert_id', as: 'author'});
  const ResourceImages = Models.Resource.hasMany(Models.Image, {foreignKey: 'assetable_id', as: 'images'});
  Models.Resource.addScope('html', {include: [HtmlResource]});
  Models.Resource.addScope('expert', {include: [ExpertResource]});
  Models.Resource.addScope('video', {include: [VideoResource]});
  Models.Resource.addScope('html_with_author', (author_id, authors_deep) => {
    let baseQuery = {
      model: Models.Html,
      as: 'html',
      include: [{
        model: Models.Resource,
        as: 'author',
        include: [{
          model: Models.Image,
          as: 'images',
          where: {
            assetable_type: {$like: 'resource_%'},
          },
          required: false
        }]
      }]
    };
    if (author_id) {
      baseQuery.where = {expert_id: author_id};
    }
    return {include: [baseQuery]}
  });
  Models.Resource.addScope('images', {
    include: [{
      model: Models.Image,
      as: 'images',
      where: {
        assetable_type: {$like: 'resource_%'},
      },
      required: false
    }]
  });

  // Franchise relations
  Models.FranchiseeRequest.belongsTo(Models.User, {foreignKey: "user_id"});
  Models.FranchiseeRequest.belongsTo(Models.Franchise);
  Models.FranchiseeRequest.addScope('user', {include: [{model: Models.User}]});
  Models.FranchiseeRequest.addScope('franchise', {include: [{model: Models.Franchise}]});
  // Provide the models back

  //Scopes
  Models.Partner.addScope('logo', { include: [ LogoOnPartner ] });
  Models.Franchise.addScope('logo', { include: [ LogoOnFranchise ] });
  Models.Franchise.addScope('htmls', { include: [ htmlOnFranchise ] });
  Models.Franchise.addScope('banner_image', { include: [ BannerImageOnFranchise ] });
  Models.Franchise.addScope('additional_photos', { include: [ AdditionalPhotosOnFranchise ] });
  Models.Franchise.addScope('type', { include: [ TypeOnFranchise ] });
  Models.Franchise.addScope('active', {include: [{required: true, model: Models.FranchiseType, as: 'FranchiseType', where: {short_name: {$notIn: ['expired', 'inactive']}}}]});
  Models.Franchise.addScope('industry', {include: [{model: Models.Industry}]});
  Models.Franchise.addScope('regions', {include: [{model: Models.FranchiseRegion}]});
  Models.Franchise.addScope('category', {include: [{model: Models.FranchiseCategory}]});
  Models.Franchise.addScope('salesforce_account', {include: [{model: Models.SalesforceAccount}]});
  Models.Franchise.addScope('categories', {include: [{model: Models.Category}]});
  Models.Franchise.addScope('investment_level', {include: [{model: Models.Investment_level}]});
  Models.Franchise.addScope('leads', {include: [{model: Models.FranchiseeRequest, required: false}]});

  Models.User.addScope('photo', { include: [ PhotoOnUser ] });

  return Models;
}
