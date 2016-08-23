
// Get a reference to the lib
import lib from 'admin-app/lib';
import configurePartner from 'shared/partner';
import configureLocale from 'shared/locale';

// Get the API authorize module
import auth from 'shared-be/authorize';

import initGlobalDirectives from 'shared/directives';
import initGlobalFilters from 'shared/filters';
import './address_populator';

// Register an initializer
lib.register((config, settings)=>{

  // TODO: Remove this once ready for prod
  window.lib = lib;

  // Configure the partner global
  configurePartner(lib, config.ngApp.config, PROPERTIES);

  // Configure the locale
  configureLocale(lib, config, settings, PROPERTIES);

  // Common Directives and filters can be used on the entire pages
  initGlobalDirectives(config.ngApp);
  initGlobalFilters(config.ngApp);

  // Configure some routes
  config.ngApp

  // Configure some libraries
  // TODO: Define if local storage dep should be added in deps instead of through login component
  .config([
    'localStorageServiceProvider'
    ,(localStorageServiceProvider)=>{

      // Setup the local storage
      localStorageServiceProvider
        .setPrefix('mfv')
        .setStorageType('localStorage')
        .setNotify(true, true)
    }
  ])

  // Expose some root scope data
  .run([
    '$rootScope'
    ,'$state'
    ,'$templateCache'
    ,($rootScope, $state, $templateCache)=>{
      // Expose the properties to the entire application as P
      $rootScope.P      = PROPERTIES;
      $rootScope.$state = $state;
      $rootScope.auth   = auth; // Authorization Module, it has constants GRANT and PERM. It also has a can method
      $rootScope.PERM   = auth.PERM; // Map of perms
      $rootScope.GRANT  = auth.GRANT; // Map of grants

      $rootScope.getImageUrl = function(path, modifiers) {
        //TODO grab this CDN from the yaml config 'cdn'
        var cdn = 'https://cdn.fullvi.com/';
        var modifiers = modifiers ? modifiers : '';
        return cdn +
          (cdn[cdn.length - 1] != '/' && modifiers[0] != '/' ? '/' : '') + // adds "/" between cdn and modifiers
          modifiers +
          (modifiers[modifiers.length - 1] != '/' && path[0] != '/' ? '/' : '') + // adds "/" between modifiers and path
          path;
      }

      // Set the global base url
      // $rootScope.pageBaseUrl = '/admin';

      // Basic check for admin user, it runs on very digest...
      // TODO: Find if there is a better/cleaner way to keep none admin users from coming
      // here (perhaps place it at the server level), for now it does not matter if a user hacks
      // to see the admin page, no data will be delivered due to api permissions.
      $rootScope.userIsAdmin = function(){
        // Use an early exit
        if($rootScope.user.isAdmin){
          return true
        }
        else if($rootScope.user&&$rootScope.user.grant_type.match(/^(user|unverified)$/)) {
          location.href = $rootScope.P.config.siteProfile;
          return false;
        }
        else if($rootScope.user){
          // Set an early exit
          console.log('running');
          $rootScope.user.isAdmin = true;
          return true;
        }

        // No user yet
        return false;
      }

      $rootScope.userIsFranchisor = function(){
        return $rootScope.user&&$rootScope.user.grant_type.match('franchis');
      }

      // Register some templates for now
      // TODO: Extract them
      $templateCache.put('assets/tpl/directives/menu-link.html',require('materialism/tpl/directives/menu-link.html'))
      $templateCache.put('assets/tpl/directives/menu-toggle.html',require('materialism/tpl/directives/menu-toggle.html'))
      $templateCache.put('assets/tpl/directives/navbar-search.html',require('materialism/tpl/directives/navbar-search.html'))
      $templateCache.put('assets/tpl/partials/dropdown-navbar.html',require('materialism/tpl/partials/dropdown-navbar.html'))
    }
  ])

  // google maps
  .config(['uiGmapGoogleMapApiProvider', function(uiGmapGoogleMapApiProvider) {
    uiGmapGoogleMapApiProvider.configure({
      //    key: 'your api key',
      v: '3.17',
      libraries: 'weather,geometry,visualization'
    });
  }])

  // loading bar settings
  .config(['cfpLoadingBarProvider', function(cfpLoadingBarProvider) {
    cfpLoadingBarProvider.includeSpinner = false;
    cfpLoadingBarProvider.latencyThreshold = 300;
  }])

  // defaults for date picker
  .config(['$datepickerProvider', function($datepickerProvider) {
    angular.extend($datepickerProvider.defaults, {
      dateFormat: 'dd/MM/yyyy',
      iconLeft: 'zmdi zmdi-chevron-left',
      iconRight: 'zmdi zmdi-chevron-right',
      autoclose: true,
    });
  }])

  // defaults for date picker
  .config(['$timepickerProvider', function($timepickerProvider) {
    angular.extend($timepickerProvider.defaults, {
      timeFormat: 'HH:mm',
      iconUp: 'zmdi zmdi-expand-less',
      iconDown: 'zmdi zmdi-expand-more',
      hourStep: 1,
      minuteStep: 1,
      arrowBehavior: 'picker',
      modelTimeFormat: 'HH:mm'
    });
  }])

  // disable nganimate with adding class
  .config(['$animateProvider', function($animateProvider) {
    $animateProvider.classNameFilter(/^(?:(?!ng-animate-disabled).)*$/);
  }])

  // Add a filter
  .filter('nospace', function () {
    return function (value) {
      return (!value) ? '' : value.replace(/ /g, '');
    };
  })


  ;

});
