(function () {
  'use strict';

  describe('Teams Route Tests', function () {
    var $scope,
      TeamsService;

    beforeEach(module('myapp'));

    beforeEach(inject(function ($rootScope, _TeamsService_) {
      $scope = $rootScope.$new();
      TeamsService = _TeamsService_;
    }));

    describe('Route Config', function () {
      describe('Main Route', function () {
        var mainState;
        beforeEach(inject(function ($state) {
          mainState = $state.get('teams');
        }));

        it('should have the correct URL', function () {
          expect(mainState.url).toEqual('/teams');
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
          listState = $state.get('teams.list');
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
          createState = $state.get('teams.create');
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
          viewState = $state.get('teams.view');
        }));

        it('should have the correct URL', function () {
          expect(viewState.url).toEqual('/view/{teamId}');
        });

        it('should not be abstract', function () {
          expect(viewState.abstract).toBe(undefined);
        });
      });

      describe('Edit Route', function () {
        var editState;
        beforeEach(inject(function ($state) {
          editState = $state.get('teams.edit');
        }));

        it('should have the correct URL', function () {
          expect(editState.url).toEqual('/edit/{teamId}');
        });

        it('should not be abstract', function () {
          expect(editState.abstract).toBe(undefined);
        });
      });
    });
  });
}());
