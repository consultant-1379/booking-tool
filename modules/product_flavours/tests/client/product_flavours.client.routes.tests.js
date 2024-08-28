(function () {
  'use strict';

  describe('ProductFlavours Route Tests', function () {
    var $scope,
      ProductFlavoursService;

    beforeEach(module('myapp'));

    beforeEach(inject(function ($rootScope, _ProductFlavoursService_) {
      $scope = $rootScope.$new();
      ProductFlavoursService = _ProductFlavoursService_;
    }));

    describe('Route Config', function () {
      describe('Main Route', function () {
        var mainState;
        beforeEach(inject(function ($state) {
          mainState = $state.get('productFlavours');
        }));

        it('should have the correct URL', function () {
          expect(mainState.url).toEqual('/productFlavours');
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
          listState = $state.get('productFlavours.list');
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
          createState = $state.get('productFlavours.create');
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
          viewState = $state.get('productFlavours.view');
        }));

        it('should have the correct URL', function () {
          expect(viewState.url).toEqual('/view/{productFlavourId}');
        });

        it('should not be abstract', function () {
          expect(viewState.abstract).toBe(undefined);
        });
      });
    });
  });
}());
