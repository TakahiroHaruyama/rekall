'use strict';
(function() {
  var module = angular.module('rekall.runplugin.controller',
                              ['manuskript.core',
                               'manuskript.core.network.service',
                               'rekall.runplugin.contextMenu.directive',
                               'rekall.runplugin.freeFormat.directive',
                               'rekall.runplugin.jsonDecoder.service',
                               'rekall.runplugin.objectActions.init',
                               'rekall.runplugin.objectActions.service',
                               'rekall.runplugin.pluginArguments.directive',
                               'rekall.runplugin.pluginRegistry.service',
                               'rekall.runplugin.rekallTable.directive',
                               'pasvaz.bindonce']);

  module.controller('RekallRunPluginController', function(
    $scope, $filter, manuskriptNetworkService,
    rekallPluginRegistryService, rekallJsonDecoderService) {

    $scope.search = {
      pluginName: null
    };

    // Updates the plugins
    var getPlugins = function() {
      rekallPluginRegistryService.getPlugins(function(result) {
        $scope.plugins = result;
        $scope.pluginsValues = [];
        for (var key in $scope.plugins) {
          $scope.pluginsValues.push($scope.plugins[key]);
        }
      });
    };

    // If the plugin changes, we need to modify the arguments.
    $scope.$watch('node.source.plugin', function() {
      if ($scope.node.source.plugin) {
        $scope.requiredArguments = [];
        $scope.optionalArguments = [];

        for (var i=0; i<$scope.node.source.plugin.arguments.length; i++) {
          var arg = $scope.node.source.plugin.arguments[i];

          if (arg.required != null) {
            $scope.requiredArguments.push(arg);
          } else {
            $scope.optionalArguments.push(arg);
          }
        }
      }
    });

    // When data appears in the plugin_state parameter we want to copy _some_ of
    // it into node.rendered for rendering.
    var copyStateToRendered = function() {
      if (!$scope.node.plugin_state) {
        return;
      };

      // For now just copy everything.
      $scope.node.rendered = angular.copy($scope.node.plugin_state.elements);
    };

    $scope.pushSources = function(node) {
      if (node.source.plugin) {
        var state = rekallJsonDecoderService.createEmptyState();
        var queue = [];

        // We hold the plugin state here.
        node.plugin_state = state;

        manuskriptNetworkService.callServer('rekall/runplugin', {
          params: {
            cell_id: node.id,
            source: angular.copy(node.source),
          },
          onclose: function(msg) {  // jshint ignore:line
            // Rendering is complete - show the node.
            node.state = "show";
          },
          onmessage: function(jsonOutput) {
            for (var i = 0; i < jsonOutput.length; ++i) {
              queue.push(jsonOutput[i]);
            }
            $scope.$evalAsync(function() {
              if (queue.length > 0) {
                rekallJsonDecoderService.decode(queue, state);

                copyStateToRendered();

                queue.splice(0, queue.length);
              }
            });
          }});

      } else {
        node.plugin_state = {
          stderr: ['No Rekall plugin was selected.'],
          stdout: [],
          error: []
        };
        node.state = "show";
      }
    };

    // Total number of elements in the view port.
    $scope.view_port_min = 0;
    $scope.view_port_max = 10;

    if ($scope.node.rendered == null) {
      $scope.node.rendered = [];
    };

    $scope.$watch('node.state', function() {
      if ($scope.node.state == 'render') {
        $scope.pushSources($scope.node);
      };

      if ($scope.node.state == 'edit') {
        $scope.pluginFocus = true;

        // Refresh the plugin list.
        getPlugins();

        if ($scope.node.source.plugin) {
          $scope.search.pluginName = $scope.node.source.plugin.name;
        } else {
          $scope.search.pluginName = "";
        }
      };

    });

    // When the user updates the plugin name we re-filter the plugin list from
    // the server to present the possible matches. NOTE: We need to re-fetch the
    // plugin list from the server each time because the list of available
    // plugins may have changed unexpectadely.
    $scope.$watch("search.pluginName", function(name) {
      $scope.selected_plugins = [];

      rekallPluginRegistryService.getPlugins(function(plugins) {
        var pluginValues = [];

        for (var key in plugins) {
          pluginValues.push(plugins[key]);
        }

        if (!$scope.search.pluginName) {
          $scope.selected_plugins = pluginValues;
          return;
        };

        for (var i=0; i<pluginValues.length; i++) {
          var plugin = pluginValues[i];

          if (plugin.name.indexOf(name) == 0) {
            $scope.selected_plugins.push(plugin);
          };
        };

        // If there is only one match - select it automatically.
        if ($scope.selected_plugins.length == 1) {
          if($scope.node.source.plugin == null ||
             $scope.node.source.plugin.name != $scope.selected_plugins[0].name) {
            $scope.node.source.plugin = $scope.selected_plugins[0];
            $scope.node.source.arguments = {};
          }
        };
      });
    });

    $scope.minimizeToggle = function($event) {
      var body = $($event.target).parents(".panel").first().find(".panel-body");
      body.toggleClass("minimized");
      $event.stopPropagation();
    };

    $scope.recalculate = function() {
      $scope.node.id = Date.now();
      $scope.renderNode($scope.node);
    };
  });

})();