export default function jsontext() {
  return {
    restrict: 'A',
    require: 'ngModel',
    link: function (scope, element, attr, ngModel) {
      function into(input) {
        var parsedJson;
        try {
          parsedJson = JSON.parse(input);
          ngModel.$setValidity('json', true);
        } catch (err) {
          ngModel.$setValidity('json', false);
          throw new Error('The json could not be parsed');
        }
        return parsedJson;
      }
      function out(data) {
        if (!data) {
          return;
        }
        return angular.toJson(data, 2);
      }

      function runFormatters(ctrl) {
        // This function is a copy of the internal formatter running code.
        // https://github.com/angular/angular.js/issues/3407#issue-17469647
        var modelValue = ctrl.$modelValue;
        var formatters = ctrl.$formatters;
        var idx = formatters.length;

        var viewValue = modelValue;
        while (idx > 0) {
          idx -= 1;
          viewValue = formatters[idx](viewValue);
        }

        if (ctrl.$viewValue !== viewValue) {
          ctrl.$viewValue = viewValue;
          ctrl.$$lastCommittedViewValue = viewValue;
          ctrl.$render();
          ctrl.$$runValidators(modelValue, viewValue, angular.noop);
        }
      }

      scope.$watch(
        function () {
          return ngModel.$modelValue;
        },
        function (newData) {
          runFormatters(ngModel);
        },
        true
      );

      ngModel.$parsers.push(into);
      ngModel.$formatters.push(out);
    }
  };
}
