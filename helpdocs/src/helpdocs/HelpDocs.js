define(['jscore/core', 'jscore/ext/locationController'], function (core, LocationController) {
    'use strict';

    return core.App.extend({
        onStart: function () {
          var lc = new LocationController({
             namespace: this.options.namespace
          });
          lc.setLocation('help/app/helpdocs');
        }
    });
});
