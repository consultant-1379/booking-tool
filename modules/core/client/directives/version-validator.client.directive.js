import semver from 'semver';

export default function versionValidator() {
  return {
    restrict: 'A',
    require: 'ngModel',
    link: function (scope, element, attr, ngModel) {
      function validate(input) {
        if (semver.valid(input)) {
          ngModel.$setValidity('version', true);
        } else {
          ngModel.$setValidity('version', false);
        }
        return input;
      }
      ngModel.$parsers.push(validate);
    }
  };
}
