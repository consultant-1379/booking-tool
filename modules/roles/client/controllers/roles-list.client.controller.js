var commonController = require('../../../core/client/controllers/common-list.client.controller');

RolesListController.$inject = [
  '$scope', '$compile', '$window', 'Notification', 'allRoles', 'Authentication', 'allRoleLogs'
];
export default function RolesListController($scope, $compile, $window, Notification, allRoles, Authentication, allRoleLogs) {
  var vm = this;
  vm.artifactType = 'Role';
  vm.artifactTypeLower = vm.artifactType.toLowerCase() + 's';
  vm.resourcePath = `/${vm.artifactTypeLower}`;

  allRoles.forEach(function (role) {
    role.history = allRoleLogs.find(log => log.associated_id === role._id);
  });

  vm.visibleArtifacts = allRoles;
  vm.dataTableColumns = [
    {
      title: 'Name',
      data: null,
      render: function (data) {
        var htmlElement = `<a ui-sref="roles.view({ roleId: '${data._id}' })">${data.name}</a>`;
        return $compile(htmlElement)($scope)[0].outerHTML;
      }
    },
    {
      title: 'Actions',
      orderable: false,
      searchable: false,
      width: '175px',
      data: null,
      render: function (data) {
        var isCreator = (data.history && (data.history.createdBy.username === Authentication.user.username));
        var viewElement = `<a class="btn btn-sm btn-info" ui-sref="roles.view({ roleId: '${data._id}' })">View</a>`;
        var compiledView = $compile(viewElement)($scope)[0].outerHTML;

        // User can edit both admins and superAdmins roles only if they are superAdmin
        var adminRoleIds = allRoles.filter(role => ['superAdmin', 'admin'].includes(role.name)).map(role => role._id);
        var isSuperAdmin = Authentication.user.userRoles.some((role) => ['superAdmin'].includes(role.name));
        var isAdminRole = adminRoleIds.includes(data._id);
        var hasEditPermissions = Authentication.isAllowed('/roles', 'put', isCreator);
        var canEdit = isSuperAdmin || (hasEditPermissions && !isAdminRole);
        var editElement = canEdit ? `<a class="btn btn-sm btn-primary" ui-sref="roles.edit({ roleId: '${data._id}' })">Edit</a>` : '<a></a>';

        var compiledEdit = $compile(editElement)($scope)[0].outerHTML;

        var hasDeletePermissions = Authentication.isAllowed('/roles', 'delete', isCreator);
        var canDelete = isSuperAdmin || (hasDeletePermissions && !isAdminRole);
        var deleteElement = canDelete ? '<a class="delete-button btn btn-sm btn-danger">Delete</a>' : '<a></a>'; // No compile needed on a non-angular element
        return `${compiledView}&nbsp;${compiledEdit}&nbsp;${deleteElement}`;
      }
    }
  ];
  commonController($scope, $window, Authentication, Notification, vm);
}
