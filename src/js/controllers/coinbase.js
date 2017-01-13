'use strict';

angular.module('copayApp.controllers').controller('coinbaseController', function($rootScope, $scope, $timeout, $ionicModal, $log, profileService, configService, storageService, coinbaseService, lodash, platformInfo, ongoingProcess, popupService, gettextCatalog, externalLinkService) {

  var isNW = platformInfo.isNW;
  var isCordova = platformInfo.isCordova;

  var init = function() {
    var config = configService.getSync().wallet.settings;
    $scope.currency = getCurrency(config.alternativeIsoCode);
    coinbaseService.getStoredToken(function(at) {
      $scope.accessToken = at;
      
      // Update Access Token if necessary
      coinbaseService.init(function(err, data) {
        if (err || lodash.isEmpty(data)) {
          if (err) {
            popupService.showAlert(gettextCatalog.getString('Error'), err);
          }
          return;
        }

        // Show rates
        coinbaseService.buyPrice(data.accessToken, $scope.currency, function(err, b) {
          $scope.buyPrice = b.data || null;
        });
        coinbaseService.sellPrice(data.accessToken, $scope.currency, function(err, s) {
          $scope.sellPrice = s.data || null;
        });

        // Updating accessToken and accountId
        $timeout(function() {
          $scope.accessToken = data.accessToken;
          $scope.accountId = data.accountId;
          $scope.updateTransactions();
          $scope.$apply();
        }, 100);
      });
    });
  };

  var getCurrency = function(code) {
    // ONLY "USD" and "EUR"
    switch(code) {
      case 'EUR' : return 'EUR';
      default : return 'USD'
    };
  };

  $scope.updateTransactions = function() {
    $log.debug('Getting transactions...');
    $scope.pendingTransactions = { data: {} };
    coinbaseService.getPendingTransactions($scope.pendingTransactions);
  };

  this.openAuthenticateWindow = function() {
    var oauthUrl = this.getAuthenticateUrl();
    if (!isNW) {
      externalLinkService.open(oauthUrl);
    } else {
      var self = this;
      var gui = require('nw.gui');
      gui.Window.open(oauthUrl, {
        focus: true,
        position: 'center'
      }, function(new_win) {
        new_win.on('loaded', function() {
          var title = new_win.window.document.title;
          $timeout(function() {
            if (title.indexOf('Coinbase') == -1) {
              $scope.code = title;
              self.submitOauthCode($scope.code);
              new_win.close();
            }
          }, 100);
        });
      });
    }
  }

  this.getAuthenticateUrl = function() {
    $scope.showOauthForm = isCordova || isNW ? false : true;
    return coinbaseService.getOauthCodeUrl();
  };

  this.submitOauthCode = function(code) {
    var self = this;
    ongoingProcess.set('connectingCoinbase', true);
    $scope.error = null;
    $timeout(function() {
      coinbaseService.getToken(code, function(err, accessToken) {
        ongoingProcess.set('connectingCoinbase', false);
        if (err) {
          popupService.showAlert(gettextCatalog.getString('Error'), err);
          return;
        }
        $scope.accessToken = accessToken;
        init();
      });
    }, 100);
  };

  this.openTxModal = function(tx) {
    $scope.tx = tx;

    $ionicModal.fromTemplateUrl('views/modals/coinbase-tx-details.html', {
      scope: $scope,
      animation: 'slide-in-up'
    }).then(function(modal) {
      $scope.modal = modal;
      $scope.modal.show();
    });
  };

  var self = this;
  $scope.$on("$ionicView.beforeEnter", function(event, data) {
    coinbaseService.setCredentials();
    if (data.stateParams && data.stateParams.code) {
      self.submitOauthCode(data.stateParams.code);
    } else {
      init();
    }
  });
});
