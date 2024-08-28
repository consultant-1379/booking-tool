(function () {
  'use strict';

  describe('Roles Route Tests', function () {
    var $scope,
      RolesService;

    beforeEach(module('myapp'));

    beforeEach(inject(function ($rootScope, _RolesService_) {
      $scope = $rootScope.$new();
      RolesService = _RolesService_;
    }));

    describe('Route Config', function () {
      describe('Main Route', function () {
        var mainState;
        beforeEach(inject(function ($state) {
          mainState = $state.get('roles');
        }));

        it('should have the correct URL', function () {
          expect(mainState.url).toEqual('/roles');
        });

        it('should be abstract', function () {
          expect(mainState.abstract).toBe(true);
        });

        it('should have template', function () {
          expect(mainState.template).toBe('<ui-view/>');
        });
      });

      describe('List Route', function () {
        var listState;
        beforeEach(inject(function ($state) {
          listState = $state.get('roles.list');
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
          createState = $state.get('roles.create');
        }));

        it('should have the correct URL', function () {
          expect(createState.url).toEqual('/create');
        });

        it('should not be abstract', function () {
          expect(createState.abstract).toBe(undefined);
        });
      });

      describe('View Route', function () {
        var viewState;
        beforeEach(inject(function ($state) {
          viewState = $state.get('roles.view');
        }));

        it('should have the correct URL', function () {
          expect(viewState.url).toEqual('/view/{roleId}');
        });

        it('should not be abstract', function () {
          expect(viewState.abstract).toBe(undefined);
        });
      });
    });
  });
}());
