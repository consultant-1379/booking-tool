(function () {
  'use strict';

  describe('Product-Types Route Tests', function () {
    var $scope,
      ProductTypesService;

    beforeEach(module('myapp'));

    beforeEach(inject(function ($rootScope, _ProductTypesService_) {
      $scope = $rootScope.$new();
      ProductTypesService = _ProductTypesService_;
    }));

    describe('Route Config', function () {
      describe('Main Route', function () {
        var mainState;
        beforeEach(inject(function ($state) {
          mainState = $state.get('productTypes');
        }));

        it('should have the correct URL', function () {
          expect(mainState.url).toEqual('/productTypes');
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
          listState = $state.get('productTypes.list');
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
          createState = $state.get('productTypes.create');
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
          viewState = $state.get('productTypes.view');
        }));

        it('should have the correct URL', function () {
          expect(viewState.url).toEqual('/view/{productTypeId}');
        });

        it('should not be abstract', function () {
          expect(viewState.abstract).toBe(undefined);
        });
      });
    });
  });
}());
