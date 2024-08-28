import YAML from 'yamljs';
import _ from 'lodash';

export default function yamltext() {
  return {
    restrict: 'A',
    require: 'ngModel',
    link: function (scope, element, attr, ngModel) {
      function into(inputString) {
        var yamlObject = YAML.parse(inputString);
        if (yamlObject && Object.prototype.hasOwnProperty.call(yamlObject, 'parameter_defaults')) {
          yamlObject.parameters = yamlObject.parameter_defaults;
          delete yamlObject.parameter_defaults;
        }
        return yamlObject;
      }
      function out(yamlObject) {
        if (!yamlObject) {
          return;
        }
        var yamlObjectCopy = _.cloneDeep(yamlObject);
        if (Object.prototype.hasOwnProperty.call(yamlObject, 'parameters')) {
          yamlObjectCopy.parameter_defaults = yamlObjectCopy.parameters;
          delete yamlObjectCopy.parameters;
        }
        return YAML.stringify(JSON.parse(angular.toJson(yamlObjectCopy)), 2);
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
