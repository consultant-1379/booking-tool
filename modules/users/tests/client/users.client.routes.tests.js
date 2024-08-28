(function () {
  'use strict';

  describe('Users Route Tests', function () {
    // Initialize global variables
    var $scope,
      Authentication,
      UsersService,
      $httpBackend;

    // We can start by loading the main application module
    beforeEach(module('myapp'));

    // The injector ignores leading and trailing underscores here (i.e. _$httpBackend_).
    // This allows us to inject a service but then attach it to a variable
    // with the same name as the service.
    beforeEach(inject(function ($rootScope, _Authentication_, _UsersService_) {
      // Set a new global scope
      $scope = $rootScope.$new();
      Authentication = _Authentication_;
      UsersService = _UsersService_;
    }));

    describe('Authentication Route Config', function () {
      describe('Main Route', function () {
        var mainState;
        beforeEach(inject(function ($state) {
          mainState = $state.get('authentication');
        }));

        it('should have the correct URL', function () {
          expect(mainState.url).toEqual('/authentication');
        });

        it('should be abstract', function () {
          expect(mainState.abstract).toBe(true);
        });
      });

      describe('Signin Route', function () {
        var signinstate;
        beforeEach(inject(function ($state) {
          signinstate = $state.get('authentication.signin');
        }));

        it('should have the correct URL', function () {
          expect(signinstate.url).toEqual('/signin?err');
        });

        it('should not be abstract', function () {
          expect(signinstate.abstract).toBe(undefined);
        });
      });
    });

    describe('Users Route Config', function () {
      describe('Main Route', function () {
        var mainState;
        beforeEach(inject(function ($state) {
          mainState = $state.get('users');
        }));

        it('should have the correct URL', function () {
          expect(mainState.url).toEqual('/users');
        });

        it('should be abstract', function () {
          expect(mainState.abstract).toBe(true);
        });
      });

      describe('List Route', function () {
        var listState;
        beforeEach(inject(function ($state) {
          listState = $state.get('users.list');
        }));

        it('should have the correct URL', function () {
          expect(listState.url).toEqual('');
        });

        it('should not be abstract', function () {
          expect(listState.abstract).toBe(undefined);
        });
      });

      describe('Create Route', function () {
        var createState;
        beforeEach(inject(function ($state) {
          createState = $state.get('users.create');
        }));

        it('should have the correct URL', function () {
          expect(createState.url).toEqual('/create');
        });

        it('should not be abstract', function () {
          expect(createState.abstract).toBe(undefined);
        });
      });
    });
  });
}());
