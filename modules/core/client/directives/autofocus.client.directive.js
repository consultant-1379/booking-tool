autofocus.$inject = ['$timeout', '$window'];

export default function autofocus($timeout, $window) {
  var directive = {
    restrict: 'A',
    link: link
  };

  return directive;

  function link(scope, element) {
    if ($window.innerWidth >= 800) {
      $timeout(function () {
        var el = element[0];
        el.focus();
        el.selectionStart = el.value.length;
        el.selectionEnd = el.value.length;
      }, 100);
    }
  }
}
