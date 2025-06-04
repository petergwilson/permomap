//OLTB imports - for the editing
import { HomeTool } from 'oltb/js/toolbar-tools/home-tool/home-tool';
import { DrawTool } from 'oltb/js/toolbar-tools/draw-tool/draw-tool';
import { EditTool } from 'oltb/js/toolbar-tools/edit-tool/edit-tool';
import { InfoTool } from 'oltb/js/toolbar-tools/info-tool/info-tool';
import { HelpTool } from 'oltb/js/toolbar-tools/help-tool/help-tool';
import { ThemeTool } from 'oltb/js/toolbar-tools/theme-tool/theme-tool';
import { LayerTool } from 'oltb/js/toolbar-tools/layer-tool/layer-tool';
import { ZoomInTool } from 'oltb/js/toolbar-tools/zoom-in-tool/zoom-in-tool';
import { ZoomboxTool } from 'oltb/js/toolbar-tools/zoombox-tool/zoombox-tool';
import { ToolboxTool } from 'oltb/js/toolbar-tools/toolbox-tool/toolbox/tool';
import { MeasureTool } from 'oltb/js/toolbar-tools/measure-tool/measure-tool';
import { MagnifyTool } from 'oltb/js/toolbar-tools/magnify-tool/magnify-tool';
import { ZoomOutTool } from 'oltb/js/toolbar-tools/zoom-out-tool/zoom-out-tool';
import { RefreshTool } from 'oltb/js/toolbar-tools/refresh-tool/refresh-tool';
import { SettingsTool } from 'oltb/js/toolbar-tools/settings-tool/settings-tool';
import { OverviewTool } from 'oltb/js/toolbar-tools/overview-tool/overview-tool';
import { ScissorsTool } from 'oltb/js/toolbar-tools/scissors-tool/scissors-tool';
import { BookmarkTool } from 'oltb/js/toolbar-tools/bookmark-tool/bookmark-tool';
import { DirectionTool } from 'oltb/js/toolbar-tools/direction-tool/direction-tool';
import { DebugInfoTool } from 'oltb/js/toolbar-tools/debug-info-tool/debug-info-tool';
import { SplitViewTool } from 'oltb/js/toolbar-tools/split-view-tool/split-view-tool';
import { ExportPngTool } from 'oltb/js/toolbar-tools/export-png-tool/export-png-tool';
import { ScaleLineTool } from 'oltb/js/toolbar-tools/scale-line-tool/scale-line-tool';
import { GraticuleTool } from 'oltb/js/toolbar-tools/graticule-tool/graticule-tool';
import { MyLocationTool } from 'oltb/js/toolbar-tools/my-location-tool/my-location-tool';
import { ResetNorthTool } from 'oltb/js/toolbar-tools/reset-north-tool/reset-north-tool';
import { FullscreenTool } from 'oltb/js/toolbar-tools/fullscreen-tool/fullscreen-tool';
import { CoordinatesTool } from 'oltb/js/toolbar-tools/coordinates-tool/coordinates-tool';
import { TranslationTool } from 'oltb/js/toolbar-tools/translation-tool/translation-tool';
import { HiddenAboutTool } from 'oltb/js/toolbar-tools/hidden-about-tool/hidden-about-tool';
import { ContextMenuTool } from 'oltb/js/toolbar-tools/context-menu-tool/context-menu-tool';
import { HiddenMarkerTool } from 'oltb/js/toolbar-tools/hidden-marker-tool/hidden-marker-tool';
import { ImportVectorLayerTool } from 'oltb/js/toolbar-tools/import-vector-layer-tool/import-vector-layer-tool';
import { HiddenMapNavigationTool } from 'oltb/js/toolbar-tools/hidden-map-navigation-tool/hidden-map-navigation-tool';

controls: defaultControls({
    zoom: false, 
    rotate: false
}).extend([
    new HiddenMarkerTool({
        onAdded: function(marker) {
            console.log('HiddenMarkerTool: Marker added', marker);
        },
        onRemoved: function(marker) {
            console.log('HiddenMarkerTool: Marker removed', marker);
        },
        onEdited: function(before, after) {
            console.log('HiddenMarkerTool: Marker edited', before, after);
        }
    }),
    new HiddenMapNavigationTool({
        focusZoom: 10
    }),
    new HomeTool({
        lon: 18.1201,
        lat: 35.3518,
        zoom: 3,
        onInitiated: function() {
            console.log('HomeTool: Initiated');
        },
        onClicked: function() {
            console.log('HomeTool: Clicked');
        },
        onBrowserStateCleared: function() {
            console.log('HomeTool: State cleared');
        },
        onNavigatedHome: function(result) {
            console.log('HomeTool: Navigated home', result);
        }
    }),
    new ZoomInTool({
        delta: 1,
        onInitiated: function() {
            console.log('ZoomInTool: Initiated');
        },
        onClicked: function() {
            console.log('ZoomInTool: Clicked');
        },
        onZoomed: function(result) {
            console.log('ZoomInTool: Zoomed in', result);
        }
    }),
    new ZoomOutTool({
        delta: -1,
        onInitiated: function() {
            console.log('ZoomOutTool: Initiated');
        },
        onClicked: function() {
            console.log('ZoomOutTool: Clicked');
        },
        onZoomed: function(result) {
            console.log('ZoomOutTool: Zoomed out', result);
        }
    }),
    new ZoomboxTool({
        onInitiated: function() {
            console.log('ZoomboxTool: Initiated');
        },
        onClicked: function() {
            console.log('ZoomboxTool: Clicked');
        },
        onBrowserStateCleared: function() {
            console.log('ZoomboxTool: State cleared');
        },
        onStart: function(event) {
            console.log('ZoomboxTool: Start', event);
        },
        onEnd: function(event) {
            console.log('ZoomboxTool: End', event);
        },
        onDrag: function(event) {
            console.log('ZoomboxTool: Drag', event);
        },
        onCancel: function(event) {
            console.log('ZoomboxTool: Cancel', event);
        },
        onError: function(event) {
            console.log('ZoomboxTool: Error', event);
        }
    }),
    new FullscreenTool({
        onInitiated: function() {
            console.log('FullscreenTool: Initiated');
        },
        onClicked: function() {
            console.log('FullscreenTool: Clicked');
        },
        onEnter: function(event) {
            console.log('FullscreenTool: Enter fullscreen', event);
        },
        onLeave: function(event) {
            console.log('FullscreenTool: Leave fullscreen', event);
        }
    }),
    new ExportPngTool({
        filename: 'map-image-export',
        appendTime: true,
        onInitiated: function() {
            console.log('ExportPngTool: Initiated');
        },
        onClicked: function() {
            console.log('ExportPngTool: Clicked');
        },
        onExported: function(filename, content) {
            console.log('ExportPngTool: PNG exported', filename, content);
        },
        onError: function(error) {
            console.log('ExportPngTool: Error', error);
        }
    }),
    new DrawTool({
        onInitiated: function() {
            console.log('DrawTool: Initiated');
        },
        onClicked: function() {
            console.log('DrawTool: Clicked');
        },
        onBrowserStateCleared: function() {
            console.log('DrawTool: State cleared');
        },
        onStart: function(event) {
            console.log('DrawTool: Start');
        },
        onEnd: function(event) {
            console.log('DrawTool: End', event.feature);
        },
        onAbort: function(event) {
            console.log('DrawTool: Abort');
        },
        onError: function(event) {
            console.log('DrawTool: Error');
        },
        onIntersected: function(event, intersectedFeatures) {
            console.log('DrawTool: Intersected', event.feature);
            console.log('DrawTool: Intersected features', intersectedFeatures);
        },
        onSnapped: function(event) {
            console.log('DrawTool: Snapped');
        },
        onUnSnapped: function(event) {
            console.log('DrawTool: UnSnapped');
        }
    }),
    new MeasureTool({
        onInitiated: function() {
            console.log('MeasureTool: Initiated');
        },
        onClicked: function() {
            console.log('MeasureTool: Clicked');
        },
        onBrowserStateCleared: function() {
            console.log('MeasureTool: State cleared');
        },
        onStart: function(event) {
            console.log('MeasureTool: Start');
        },
        onEnd: function(event) {
            console.log('MeasureTool: End', event.feature);
        },
        onAbort: function(event) {
            console.log('MeasureTool: Abort');
        },
        onError: function(event) {
            console.log('MeasureTool: Error');
        }
    }),
    new EditTool({
        hitTolerance: 5,
        onInitiated: function() {
            console.log('EditTool: Initiated');
        },
        onClicked: function() {
            console.log('EditTool: Clicked');
        },
        onBrowserStateCleared: function() {
            console.log('EditTool: State cleared');
        },
        onStyleChange: function(event, style) {
            console.log('EditTool: Style changed');
        },
        onCutFeatures: function(features) {
            console.log('EditTool: Cut features', features);
        },
        onCopyFeatures: function(features) {
            console.log('EditTool: Copied features', features);
        },
        onPasteFeatures: function(features, layerWrapper) {
            console.log('EditTool: Pasted features', features);
        },
        onShapeOperation: function(type, a, b, result) {
            console.log('EditTool: Shape operation', type);
        },
        onSelectAdd: function(event) {
            console.log('EditTool: Selected feature');
        },
        onSelectRemove: function(event) {
            console.log('EditTool: Deselected feature');
        },
        onModifyStart: function(event) {
            console.log('EditTool: Modify start');
        },
        onModifyEnd: function(event) {
            console.log('EditTool: Modify end');
        },
        onTranslateStart: function(event) {
            console.log('EditTool: Translate start');
        },
        onTranslateEnd: function(event) {
            console.log('EditTool: Translate end');
        },
        onRemovedFeatures: function(features) {
            console.log('EditTool: Removed features', features);
        },
        onError: function(event) {
            console.log('EditTool: Error');
        },
        onSnapped: function(event) {
            console.log('EditTool: Snapped');
        },
        onUnSnapped: function(event) {
            console.log('EditTool: UnSnapped');
        }
    }),
    new ScissorsTool({
        onStart: function(event) {
            console.log('ScissorsTool: Start');
        },
        onEnd: function(event) {
            console.log('ScissorsTool: End', event.feature);
        },
        onAbort: function(event) {
            console.log('ScissorsTool: Abort');
        },
        onError: function(event) {
            console.log('ScissorsTool: Error');
        },
        onSnapped: function(event) {
            console.log('ScissorsTool: Snapped');
        },
        onUnSnapped: function(event) {
            console.log('ScissorsTool: UnSnapped');
        }
    }),
    new BookmarkTool({
        markerLayerVisibleOnLoad: true,
        markerLabelUseEllipsisAfter: 20,
        markerLabelUseUpperCase: false,
        bookmarks: [{
            id: '6812cc22-f490-46b7-a9f3-42eb9ea58ac2',
            name: 'Custom bookmark',
            zoom: 5,
            coordinates: [57.123, 16.456]
        }],
        onInitiated: function() {
            console.log('BookmarkTool: Initiated');
        },
        onClicked: function() {
            console.log('BookmarkTool: Clicked');
        },
        onBrowserStateCleared: function() {
            console.log('BookmarkTool: State cleared');
        },
        onAdded: function(bookmark) {
            console.log('BookmarkTool: Added', bookmark);
        },
        onRemoved: function(bookmark) {
            console.log('BookmarkTool: Removed', bookmark);
        },
        onRenamed: function(bookmark) {
            console.log('BookmarkTool: Renamed', bookmark);
        },
        onZoomedTo: function(bookmark) {
            console.log('BookmarkTool: Zoomed to', bookmark);
        },
        onCleared: function() {
            console.log('BookmarkTool: Cleared');
        },
        onDragged: function(item, list) {
            console.log('BookmarkTool: Dragged', item, list);
        }
    }),
    new LayerTool({
        onInitiated: function() {
            console.log('LayerTool: Initiated');
        },
        onClicked: function() {
            console.log('LayerTool: Clicked');
        },
        onBrowserStateCleared: function() {
            console.log('LayerTool: State cleared');
        },
        onMapLayerAdded: function(layerWrapper) {
            console.log('LayerTool: Map layer added', layerWrapper);
        },
        onMapLayerRemoved: function(layerWrapper) {
            console.log('LayerTool: Map layer removed', layerWrapper);
        },
        onMapLayerRenamed: function(layerWrapper) {
            console.log('LayerTool: Map layer renamed', layerWrapper);
        },
        onMapLayerVisibilityChanged: function(layerWrapper) {
            console.log('LayerTool: Map layer visibility change', layerWrapper);
        },
        onMapLayerDragged(item, list) {
            console.log('LayerTool: Map layer dragged', item, list);
        },
        onFeatureLayerAdded: function(layerWrapper) {
            console.log('LayerTool: Feature layer added', layerWrapper);
        },
        onFeatureLayerRemoved: function(layerWrapper) {
            console.log('LayerTool: Feature layer removed', layerWrapper);
        },
        onFeatureLayerRenamed: function(layerWrapper) {
            console.log('LayerTool: Feature layer renamed', layerWrapper);
        },
        onFeatureLayerVisibilityChanged: function(layerWrapper) {
            console.log('LayerTool: Feature layer visibility change', layerWrapper);
        },
        onFeatureLayerDownloaded: function(layerWrapper, filename, content) {
            console.log('LayerTool: Feature layer downloaded', layerWrapper, filename, content);
        },
        onFeatureLayerDragged(item, list) {
            console.log('LayerTool: Feature layer dragged', item, list);
        }
    }),
    new SplitViewTool({
        onInitiated: function() {
            console.log('SplitViewTool: Initiated');
        },
        onClicked: function() {
            console.log('SplitViewTool: Clicked');
        },
        onBrowserStateCleared: function() {
            console.log('SplitViewTool: State cleared');
        }
    }),
    new OverviewTool({
        onInitiated: function() {
            console.log('OverviewTool: Initiated');
        },
        onClicked: function() {
            console.log('OverviewTool: Clicked');
        },
        onBrowserStateCleared: function() {
            console.log('OverviewTool: State cleared');
        }
    }),
    new GraticuleTool({
        color: '#3B4352E6',
        dashed: true,
        width: 2,
        showLabels: true,
        wrapX: true,
        onInitiated: function() {
            console.log('GraticuleTool: Initiated');
        },
        onClicked: function() {
            console.log('GraticuleTool: Clicked');
        },
        onBrowserStateCleared: function() {
            console.log('GraticuleTool: State cleared');
        }
    }),
    new MagnifyTool({
        radius: 75,
        min: 25,
        max: 150,
        onInitiated: function() {
            console.log('MagnifyTool: Initiated');
        },
        onClicked: function() {
            console.log('MagnifyTool: Clicked');
        },
        onBrowserStateCleared: function() {
            console.log('MagnifyTool: State cleared');
        }
    }),
    new ResetNorthTool({
        onInitiated: function() {
            console.log('ResetNorthTool: Initiated');
        },
        onClicked: function() {
            console.log('ResetNorthTool: Clicked');
        },
        onReset: function() {
            console.log('ResetNorthTool: North reset', result);
        }
    }),
    new CoordinatesTool({
        onInitiated: function() {
            console.log('CoordinatesTool: Initiated');
        },
        onClicked: function() {
            console.log('CoordinatesTool: Clicked');
        },
        onBrowserStateCleared: function() {
            console.log('CoordinatesTool: State cleared');
        },
        onMapClicked: function(coordinates) {
            console.log('CoordinatesTool: Map clicked at', coordinates);
        }
    }),
    new MyLocationTool({
        enableHighAccuracy: true,
        timeout: 10000,
        description: 'This is the location that the browser was able to find. It might not be your actual location.',
        markerLabelUseEllipsisAfter: 20,
        markerLabelUseUpperCase: false,
        onInitiated: function() {
            console.log('MyLocationTool: Initiated');
        },
        onClicked: function() {
            console.log('MyLocationTool: Clicked');
        },
        onLocationFound: function(location) {
            console.log('MyLocationTool: Location found', location);
        },
        onError: function(error) {
            console.log('MyLocationTool: Error', error);
        }
    }),
    new ImportVectorLayerTool({
        onInitiated: function() {
            console.log('ImportVectorLayerTool: Initiated');
        },
        onClicked: function() {
            console.log('ImportVectorLayerTool: Clicked');
        },
        onImported: function(features) {
            console.log('ImportVectorLayerTool: Imported', features);
        },
        onError: function(filename, error) {
            console.log('ImportVectorLayerTool: Error', filename, error);
        }
    }),
    new ScaleLineTool({
        units: 'metric',
        onInitiated: function() {
            console.log('ScaleLineTool: Initiated');
        },
        onClicked: function() {
            console.log('ScaleLineTool: Clicked');
        },
        onBrowserStateCleared: function() {
            console.log('ScaleLineTool: State cleared');
        }
    }),
    new RefreshTool({
        onInitiated: function() {
            console.log('RefreshTool: Initiated');
        },
        onClicked: function() {
            console.log('RefreshTool: Clicked');
        }
    }),
    new ThemeTool({
        onInitiated: function() {
            console.log('ThemeTool: Initiated');
        },
        onClicked: function() {
            console.log('ThemeTool: Clicked');
        },
        onBrowserStateCleared: function() {
            console.log('ThemeTool: State cleared');
        },
        onChanged: function(theme) {
            console.log('ThemeTool: Changed to', theme);
        }
    }),
    new DirectionTool({
        onInitiated: function() {
            console.log('DirectionTool: Initiated');
        },
        onClicked: function() {
            console.log('DirectionTool: Clicked');
        },
        onBrowserStateCleared: function() {
            console.log('DirectionTool: State cleared');
        },
        onChanged: function(direction) {
            console.log('DirectionTool: Changed to', direction);
        }
    }),
    new ToolboxTool({
        onInitiated: function() {
            console.log('ToolboxTool: Initiated');
        },
        onClicked: function() {
            console.log('ToolboxTool: Clicked');
        },
        onBrowserStateCleared: function() {
            console.log('ToolboxTool: State cleared');
        },
        onChanged: function(state) {
            console.log('ToolboxTool: Changed to', state);
        }
    }),
    new InfoTool({
        title: 'Hey!', 
        content: '<p>This is a <strong>modal window</strong>, here you can place some text about your application or links to external resources.</p>',
        onInitiated: function() {
            console.log('InfoTool: Initiated');
        },
        onClicked: function() {
            console.log('InfoTool: Clicked');
        }
    }),
    new TranslationTool({
        onInitiated: function() {
            console.log('TranslationTool: Initiated');
        },
        onClicked: function() {
            console.log('TranslationTool: Clicked');
        },
    }),
    new HelpTool({
        url: 'https://github.com/qulle/oltb',
        target: '_blank',
        onInitiated: function() {
            console.log('HelpTool: Initiated');
        },
        onClicked: function() {
            console.log('HelpTool: Clicked');
        }
    }),
    new SettingsTool({
        onInitiated: function() {
            console.log('SettingsTool: Initiated');
        },
        onClicked: function() {
            console.log('SettingsTool: Clicked');
        },
        onBrowserStateCleared: function() {
            console.log('SettingsTool: State cleared');
        }
    }),
    new DebugInfoTool({
        onlyWhenGetParameter: false,
        onInitiated: function() {
            console.log('DebugInfoTool: Initiated');
        },
        onClicked: function() {
            console.log('DebugInfoTool: Clicked');
        }
    }),
    new HiddenAboutTool(),
    new ContextMenuTool()
])