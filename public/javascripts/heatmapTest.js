var map;
var csvFileName = '../data/'+title+'.csv';
var dataMatrix;
var q = d3.queue();
var check = false;
var largestIndividualArray = [];
var sort = [];
var selectZone = '101'; //default selectZone when you open the browser. 
var hoverZone; //mouse-over zone
console.log(title+'.csv');
q.defer(d3.csv,csvFileName).await(brushMap);
function brushMap(error,csvFile){
    dataMatrix = buildMatrixLookup(csvFile);
    require([
      "esri/geometry/Polyline",
      "esri/geometry/Extent",
      "dojo/dom-construct",
      "esri/tasks/query",
      "esri/dijit/Popup",
      "esri/dijit/PopupTemplate",
      "dojo/dom-class",
      "esri/dijit/BasemapToggle",
      "esri/dijit/Legend",
        "esri/map", "esri/layers/FeatureLayer",
        "esri/InfoTemplate", "esri/symbols/SimpleFillSymbol", "esri/symbols/SimpleLineSymbol",
        "esri/renderers/ClassBreaksRenderer","esri/renderers/HeatmapRenderer",
        "esri/Color", "dojo/dom-style", "dojo/domReady!"
    ], function(Polyline,
      Extent,domConstruct,
      Query,Popup, PopupTemplate,domClass,BasemapToggle,Legend,Map, FeatureLayer,
        InfoTemplate, SimpleFillSymbol,SimpleLineSymbol,
        ClassBreaksRenderer,HeatmapRenderer,
        Color, domStyle
    ) {

        var popup = new Popup({  
          fillSymbol:
            new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
              new Color([255, 0, 0]), 2)
        }, domConstruct.create("div"));

        map = new Map("map", {
            basemap: "gray",
            center: [-113.4909, 53.5444],
            zoom: 9,
            minZoom:6,
            infoWindow: popup,
            slider: false
        });
        map.setInfoWindowOnClick(true);
        //toggle the basemap
        var toggle = new BasemapToggle({
           map: map,
           basemap: "streets"
         }, "viewDiv");

         toggle.startup();

        var template = new InfoTemplate();
        template.setContent(getTextContent);
        //travelZonelayer
        var travelZoneLayer = new FeatureLayer("https://services8.arcgis.com/FCQ1UtL7vfUUEwH7/arcgis/rest/services/newestTAZ/FeatureServer/0",{
            mode: FeatureLayer.MODE_SNAPSHOT,
            outFields: ["TAZ_New"],

        });
        var travelZoneCentroidLayer = new FeatureLayer("//services8.arcgis.com/FCQ1UtL7vfUUEwH7/arcgis/rest/services/Centroids_for_Edmonton_RTM_TAZ20180305/FeatureServer/0",{
            mode: FeatureLayer.MODE_SNAPSHOT,
            outFields: ["TAZ_New"],
        
        });
        //LRT layer
        var lrtFeatureLayer = new FeatureLayer("https://services8.arcgis.com/FCQ1UtL7vfUUEwH7/arcgis/rest/services/LRT/FeatureServer/0",{
            mode: FeatureLayer.MODE_SNAPSHOT,
            outFields: ["*"],
        });
        //click on travelZoneLayer event
        travelZoneLayer.on('click',function(evt){
            var graphic = evt.graphic;
            selectZone = graphic.attributes.TAZ_New;
            var query = new Query();
            query.geometry = pointToExtent(map, event.mapPoint, 10);
            var deferred = travelZoneLayer.selectFeatures(query,
              travelZoneLayer.SELECTION_NEW);
            map.infoWindow.setFeatures([deferred]);
            map.infoWindow.show(event.mapPoint);
            travelZoneCentroidLayer.redraw();
        })
        //mouse over event
        travelZoneLayer.on('mouse-over',function(evt){
            var graphic = evt.graphic;
            hoverZone = graphic.attributes.TAZ_New;
            var access;
            if(check === false){
              access = dataMatrix[selectZone][hoverZone];
            }
            else{
              access = dataMatrix[hoverZone][selectZone];
            }

            map.infoWindow.setTitle("<b>Zone Number: </b>"+hoverZone);
            if(typeof(access)!=='undefined'){
              map.infoWindow.setContent("<b><font size=\"3\"> Value:</font> </b>"+ "<font size=\"4\">"+access.toFixed(2)+"</font>");
            }
            else{
              map.infoWindow.setContent("<b><font size=\"3\"> Value:</font> </b>"+ "<font size=\"4\">"+'undefined'+"</font>");
            }
            map.infoWindow.show(evt.screenPoint,map.getInfoWindowAnchor(evt.screenPoint));
        });
        //adjust the legend range dynamically based on current matrix 
        var accessibilityResult = [];
        largestIndividualArray = findRangeForIndividualCalcultion();
        sort = Object.values(largestIndividualArray).sort((prev,next)=>prev-next); //from smallest to largest
        sort = sort.map(x =>x.toFixed(2)); //make legend to 2 decimal numbers.

        var chunkZones = 89;         
        var symbol = new SimpleFillSymbol(); 
        var renderer = new ClassBreaksRenderer(symbol, function(feature){
          return 1
       });
       //legend. If you want to change legend scale or legend color, this part of code needs to be modified
       renderer.addBreak(-Infinity, Infinity, new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,new Color([0,0,0,0.3]),1)).setColor(new Color([255, 255, 255,0.0])));
       travelZoneLayer.setRenderer(renderer);
        var heatmapRenderer = new HeatmapRenderer({
            field: function(feature){
              if(check === false){
                   return dataMatrix[selectZone][feature.attributes.TAZ_New]+1;
                 }
                 else{
                   return dataMatrix[feature.attributes.TAZ_New][selectZone];
                 }
            },
            blurRadius: 15,
            maxPixelIntensity: 15,
            minPixelIntensity:0
        });
        heatmapRenderer.setColorStops([
        { ratio: 0, color: "rgba(250, 0, 0, 0)" },
        { ratio: 0.2, color: "rgb(250, 0, 0)" },
        { ratio: 0.4, color: "rgb(250, 50, 0)" },
        { ratio: 0.6, color: "rgb(250, 100, 0)" },
        { ratio: 0.80, color: "rgb(250, 150, 0)"},
        { ratio: 0.95, color: "rgb(255, 200, 0)"}]);
       //legend. If you want to change legend scale or legend color, this part of code needs to be modified
      travelZoneCentroidLayer.setRenderer(heatmapRenderer);
       //legend  
  
        map.on('load',function(){
            map.addLayer(travelZoneLayer);
            map.addLayer(lrtFeatureLayer);
            map.addLayer(travelZoneCentroidLayer);
            travelZoneLayer.redraw();
        });


        function pointToExtent (map, point, toleranceInPixel) {
          var pixelWidth = map.extent.getWidth() / map.width;
          var toleranceInMapCoords = toleranceInPixel * pixelWidth;
          return new Extent(point.x - toleranceInMapCoords,
                            point.y - toleranceInMapCoords,
                            point.x + toleranceInMapCoords,
                            point.y + toleranceInMapCoords,
                            map.spatialReference);
        }
        function getTextContent (graphic) {
          var speciesName = "<b>Value: </b><br/>" +
                          "<i>" + accessibilityResult[graphic.attributes.TAZ_New] + "</i>";
          return  speciesName;
        }
        //'origin to destination' or 'destination to origin
        $("#interact").click(function(e, parameters) {
            if($("#interact").is(':checked')){
                check = true;
                travelZoneCentroidLayer.redraw();  
            }
            else{
              check = false;
              travelZoneCentroidLayer.redraw();

            }
        });
    });
}

//convert csv array into good format(zone-to-zone).
function buildMatrixLookup(arr) {    
  var lookup = {};
  var index = arr.columns;
  var verbal = index[0];
  for(var i =0; i<arr.length;i++){
    var k = arr[i][verbal];
    delete arr[i][verbal];
    lookup[parseInt(k)] = Object.keys(arr[i]).reduce((obj, key) => (obj[parseInt(key)] = Number(arr[i][key]),obj), {});
  }

  return lookup;
}
//the legend range is based on the data for zone101
//you can change it to other algorithm
function findRangeForIndividualCalcultion(){
  return dataMatrix['101'];
}
