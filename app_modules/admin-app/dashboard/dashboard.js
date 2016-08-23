require('./dashboard.scss');

var tmpl = require('./dashboard.htm');

// Imports
import lib from 'admin-app/lib';
import moment from 'moment';
import {GOOGLE_CHARTS} from './dashboard.charts.js';
import ReportFiles from 'shared/report-files';

// Classes are just sugar, technically they are stil a good'ol Function :)
class Dashboard {
  constructor($rootScope, $scope, $http, $window, $timeout, $stateParams, $templateCache) {

    // Dynamic view per user grant type superadmin, franchisor, etc..
    try{
      var view = require('./'+$rootScope.user.grant_type+'.htm');
    }catch(e){
      var view = require('./superadmin.htm');
    }

    $templateCache.put('view.html', view);

    // Loads startDate and endDate from location hash (if possible)
    let searchFilter = ReportFiles.initSearchObject({
      'start-date': [new Date($stateParams['start-date']), moment().subtract(20, "days")].filter(ReportFiles.isDate),
      'end-date': [new Date($stateParams['end-date']), moment().subtract(1, "days")].filter(ReportFiles.isDate)
    });

    $scope.searchFilter = searchFilter;
    $scope.charts = {};

    $scope.leadsData = {
      total: 0,
      segments: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    };
    $scope.newsusersData = {
      total: 0,
      segments: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    };

    $scope.signupsData = {
      total: 0,
      segments: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    };

    $scope.visitorsData = {
      total: 0,
      segments: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    };

    $scope.chartObjects = {};

    $scope.franchises = {
      topArray: [],
      lowArray: [],
      expArray: []
    };

    $scope.signupChartCallabck = function(chartObj) {
      $scope.chartObjects.signups = chartObj;
    }

    $scope.leadsChartCallabck = function(chartObj) {
      $scope.chartObjects.leads = chartObj;
    }

    $scope.newsuserChartCallabck = function(chartObj) {
      $scope.chartObjects.newsusers = chartObj;
    }

    $scope.loadWebData = function(searchFilter) {
      var url;
      if ($rootScope.userIsFranchisor()){
        url = '/api/reports/franchisor_dashboard';
      }else{
        url = '/api/reports/dashboard';
      }

      $http.post(url, searchFilter)
        .then((res) => {

          $scope.leadsData = res.data.leads || {};
          $scope.newsusersData = res.data.newsusers || {};
          $scope.signupsData = res.data.signups || {};
          $scope.visitorsData = res.data.visitors || {} || {};

          $scope.franchises.topArray = res.data.topArray;
          $scope.franchises.lowArray = res.data.lowArray;
          $scope.franchises.expArray = res.data.expArray;

          var leadsColumn = ['Leads'].concat($scope.leadsData.segments);
          var usersColumn = ['Signups'].concat($scope.signupsData.segments);
          var visitorsColumn = ['Visitors'].concat($scope.visitorsData.segments);
          var newsColumn = ['Newsletter'].concat($scope.newsusersData.segments);
          $timeout(function() {
            $scope.chartObjects.leads.load({columns: [leadsColumn]});
            $scope.chartObjects.signups.load({columns: [usersColumn]});
            $scope.chartObjects.visitors.load({columns: [visitorsColumn]});
            $scope.chartObjects.newsusers.load({columns: [newsColumn]});
          }, 100)
        })
        .catch((res) => {
          console.error(res);
          alert('An error occured!');
        });
    }

    $window.gapi.analytics.ready(function() {
      var gapi = $window.gapi;
      $http.get('/api/analytics/token').then(function(res) {
        gapi.analytics.auth.authorize({
          serverAuth: { access_token: res.data.access_token }
        });

        var dateRange = {
          'start-date': ReportFiles.getDateStr(searchFilter['start-date']),
          'end-date': ReportFiles.getDateStr(searchFilter['end-date'])
        };

        var dateRangeSelector = new gapi.analytics.ext.DateRangeSelector({
          container: 'date-range-selector'
        }).set(dateRange).execute();

        $scope.loadWebData(dateRange);

        let charts = {};
        let chartsLoadingNum = 0;

        for(let chartName in GOOGLE_CHARTS) {
          charts[chartName] = new gapi.analytics.googleCharts.DataChart(GOOGLE_CHARTS[chartName]);
          charts[chartName].set({ query: dateRange });
          charts[chartName].on('success', function(res) {
            $scope.charts[chartName] = res.response.totalsForAllResults['ga:sessions'];

            // Sending message to the console so phantomjs could catch that when charts loading is finished.
            chartsLoadingNum--;
            if (chartsLoadingNum == 0) {
              ReportFiles.pageIsReady();
            }
          });
          charts[chartName].execute();
          chartsLoadingNum++;
        }

        dateRangeSelector.on('change', function(data) {
          for(let chartName in GOOGLE_CHARTS) {
            charts[chartName].set({ query: data }).execute();
          }
          if (data['start-date']) searchFilter['start-date'] = new Date(data['start-date']);
          if (data['end-date']) searchFilter['end-date'] = new Date(data['end-date']);

          $scope.loadWebData(data);
        });
      });
    });
  }
}
var controller = ['$rootScope', '$scope', '$http', '$window', '$timeout', '$stateParams', '$templateCache', Dashboard];

// By convention adding components is done through libs
// libs are simple wrappers with enough flexibility to
// ease the usage of lazy loading, the provide delayed
// callbacks, until an app is ready start or are added
// as soon as they become available
lib.addComponent('dashboard', {
  template: tmpl,
  controller: controller,
  scope: {}
});