'use strict';

(function () {
  // Authentication controller Spec
  describe('AuthenticationController', function () {
    // Initialize global variables
    var AuthenticationController,
      scope,
      $httpBackend,
      $stateParams,
      $state,
      $location,
      Notification;

    beforeEach(function () {
      jasmine.addMatchers({
        toEqualData: function (util, customEqualityTesters) {
          return {
            compare: function (actual, expected) {
              return {
                pass: angular.equals(actual, expected)
              };
            }
          };
        }
      });
    });

    // Load the main application module
    beforeEach(module('myapp'));

    describe('Logged out user', function () {
      // The injector ignores leading and trailing underscores here (i.e. _$httpBackend_).
      // This allows us to inject a service but then attach it to a variable
      // with the same name as the service.
      beforeEach(inject(function (
        $controller, $rootScope, _$location_,
        _$stateParams_, _$httpBackend_, _Notification_
      ) {
        // Set a new global scope
        scope = $rootScope.$new();
        scope.showNavBar = function (status) {
          scope.navbarActive = status;
        };

        // Point global variables to injected services
        $stateParams = _$stateParams_;
        $httpBackend = _$httpBackend_;
        $location = _$location_;
        Notification = _Notification_;

        // Spy on Notification
        spyOn(Notification, 'error');
        spyOn(Notification, 'success');

        // Ignore parent template get on state transitions
        $httpBackend.whenGET('/modules/core/client/views/home.client.view.html').respond(200);
        $httpBackend.whenGET('/modules/core/client/views/400.client.view.html').respond(200);
        $httpBackend.whenGET('/modules/users/client/views/authentication/authentication.client.view.html').respond(200);
        $httpBackend.whenGET('/modules/users/client/views/authentication/signin.client.view.html').respond(200);

        // Initialize the Authentication controller
        AuthenticationController = $controller('AuthenticationController as vm', {
          $scope: scope
        });
      }));

      describe('$scope.signin()', function () {
        it('should login with a correct user and password', inject(function ($templateCache) {
          $templateCache.put('/modules/core/client/views/home.client.view.html', '');

          // Test expected GET request
          $httpBackend.when('POST', '/api/auth/signin').respond(200, { username: 'Fred', roles: ['user'] });
          scope.vm.signin();
          $httpBackend.flush();

          // Test scope value
          expect(scope.vm.authentication.user.username).toEqual('Fred');
          expect($location.url()).toEqual('/');
        }));

        it('should login with a correct email and password', inject(function ($templateCache) {
          $templateCache.put('/modules/core/client/views/home.client.view.html', '');
          // Test expected GET request
          $httpBackend.when('POST', '/api/auth/signin').respond(200, { email: 'Fred@email.com' });
          scope.vm.signin();
          $httpBackend.flush();

          // Test scope value
          expect(scope.vm.authentication.user.email).toEqual('Fred@email.com');
          expect($location.url()).toEqual('/');
        }));

        it(
          'should be redirected to previous state after successful login',
          inject(function (_$state_) {
            $state = _$state_;
            $state.previous = {
              to: {
                name: 'schemas.list'
              },
              params: {}
            };

            spyOn($state, 'transitionTo');
            spyOn($state, 'go');

            // Test expected GET request
            $httpBackend.when('POST', '/api/auth/signin').respond(200, 'Fred');

            scope.vm.signin();
            $httpBackend.flush();

            // Test scope value
            expect($state.go).toHaveBeenCalled();
            expect($state.go).toHaveBeenCalledWith($state.previous.to.name, {});
          })
        );

        it('should fail to log in with nothing', function () {
          // Test expected POST request
          $httpBackend.expectPOST('/api/auth/signin').respond(400, {
            message: 'Missing credentials'
          });

          scope.vm.signin();
          $httpBackend.flush();

          // Test Notification.error is called
          expect(Notification.error).toHaveBeenCalledWith({
            message: 'Missing credentials',
            title: '<i class="glyphicon glyphicon-remove"></i> Signin Error!',
            delay: 6000
          });
        });

        it('should fail to log in with wrong credentials', function () {
          // Foo/Bar combo assumed to not exist
          scope.vm.authentication.user = { username: 'Foo' };
          scope.vm.credentials = 'Bar';

          // Test expected POST request
          $httpBackend.expectPOST('/api/auth/signin').respond(400, {
            message: 'Unknown user'
          });

          scope.vm.signin();
          $httpBackend.flush();

          // Test Notification.error is called
          expect(Notification.error).toHaveBeenCalledWith({
            message: 'Unknown user',
            title: '<i class="glyphicon glyphicon-remove"></i> Signin Error!',
            delay: 6000
          });
        });
      });
    });

    describe('Logged in user', function () {
      beforeEach(inject(function ($controller, $rootScope, _$location_, _Authentication_) {
        scope = $rootScope.$new();

        $location = _$location_;
        $location.path = jasmine.createSpy().and.returnValue(true);

        // Mock logged in user
        _Authentication_.user = {
          username: 'test',
          roles: ['user']
        };

        AuthenticationController = $controller('AuthenticationController as vm', {
          $scope: scope
        });
      }));

      it('should be redirected to home', function () {
        expect($location.path).toHaveBeenCalledWith('/');
      });
    });
  });
}());
