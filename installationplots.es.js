//The alias of the published dataverse to show statistics for (stats are for this dataverse and all published children)
var alias;
//The Dataverse server address - can be "" if this app is deployed on the same server.
var dvserver = "https://edatos.consorciomadrono.es";

$(document).ready(function() {

  //Determine which dataverse/sub-dataverse is the focus for the metrics
  // (Metrics are for the specified public/published dataverse and all it's public/published children)
  var urlParams = new URLSearchParams(window.location.search);
  alias = (urlParams.get('parentAlias'));

  //Retrieve the configuration,  complete the header, and start creating graphs
  $.getJSON('config.local.es.json', function(config) {

    // Set the Dataverse server to use
    if (config.hasOwnProperty("installationURL")) {
      dvserver = config.installationURL;
    }

    // Retrieve the tree of child dataverses and add them to the tree we use as a selector
    // getJSON could be used throughout (it wasn't previously due to bugs in the API endpoints in determining when to send json versus dvserver + text/csv)
    $.getJSON(
      dvserver + '/api/info/metrics/tree' + addAlias(),
      function(data) {
        var nodes = data.data;
        if (typeof nodes.children !== 'undefined') {
          nodes.children.forEach((node) => {
            //Make each element in the tree (below the root) a link to get the metrics for that sub-dataverse
            updateNames(node);
          });
        }
        //Populate the tree widget
        $('#dvtree').tree({
          data: [nodes],
          autoEscape: false
        });
      }
    );

    //Header Information
    $('#title').html("<H1>Métricas de " + config.installationName + "</H1>");
    if (alias == null) {
      $('#subtitle').html("<h2>Mostrando las métricas completas del repositorio</h2>");
      $('#selectString').html('<div>Pincha en el nombre del sub-' + config.dataverseTerm + ' para ver sus métricas</div>');
    } else {
      $('#subtitle').html("<h2>Mostrando las métricas de " + alias + " " + config.dataverseTerm + "</h2>");
      $('#selectString').html('<div><a href="/dataverse-metrics">Mostrando las métricas completas del repositorio</a></div><div>Pinche en el nombre del sub-' + config.dataverseTerm + ' para ver sus métricas</div>');
    }
    
    //Panels
    if(config.hasOwnProperty("downloadsHeader")) {
      $("#downloadSection").find("a").text(config.downloadsHeader);
    }
    if(config.hasOwnProperty("makeDataCountHeader")) {
      $("#mdcSection").find("a").text(config.makeDataCountHeader);
    }
    if(config.hasOwnProperty("holdingsHeader")) {
      $("#holdingsSection").find("a").text(config.holdingsHeader);
    }
    
    //Footer
    if (config.hasOwnProperty("globalConfigured")) {
      if(config.globalConfigured === "true") {
        $("#global").html('<a href="/dataverse-metrics/global">View Aggregate Metrics from the Dataverse Community</a>'); 
      }
    }

    //Individual graphs
    //Row 1
    timeseries("Dataverses", config);
    timeseries("Datasets", config);
    //Row 2
    dataversesByCategory(config);
    dataversesBySubject(config);
    //Row 3
    datasetsBySubject(config);
    timeseries("Files", config);
    //Row 4
    timeseries("Downloads", config);
    uniqueDownloads(config);
    //Row 5
    fileDownloads(config);
    //Row 6
    multitimeseries("UniqueDownloads", config, "pid");
    //Row 7 - by Count and by Size graphs
    filesByType(config);
    //Row 8
    makeDataCount("viewsTotal", config);
    makeDataCount("downloadsTotal", config);
    //Row 9
    makeDataCount("viewsUnique", config);
    makeDataCount("downloadsUnique", config);

  });
});

//Generic graph of time series - date versus count
function timeseries(name, config) {
  var lcname = name.toLowerCase();
  var nameLabel = name;
  var singular = lcname.substring(0, lcname.length -1);
  if(config.hasOwnProperty(singular + "Term")) {
    nameLabel = config[singular + "Term"] + "s";
  }
  var color = config["colors"][lcname + "/monthly"];
  $.ajax({
    url: dvserver + '/api/info/metrics/' + lcname + '/monthly' + addAlias(),
    headers: { Accept: "application/json" },
    success: function(data) {

      data = data.data;
      var yLabel = "Número de " + nameLabel.replace('Downloads','Descargas').replace('Files','Ficheros');
      var visualization = d3plus.viz()
        .data(data)
        .title(nameLabel.replace('Downloads','Descargas').replace('Files','Ficheros'))
        .container("#" + lcname)
        .type("bar")
        .id("date")
        .x({
          "value": "date",
          "label": "Mes"
        })
        .y({
          "range": [0, data[data.length - 1].count * 1.3],
          "value": "count",
          "label": yLabel
        })
        .color(function(d) {
          return color;
        })
        .resize(true);
      if(config.hasOwnProperty("timeseries." + lcname + ".definition")) {
        var explain = config["timeseries." + lcname + ".definition"];
        visualization.footer(config["timeseries." + lcname + ".definition"]);
      }
      visualization.draw();
    }
  });
  $("#" + lcname).append($("<a/>").addClass("button").attr("href", "/api/info/metrics/" + lcname + "/monthly" + addAlias()).attr("type", "text/csv").text("CSV"));
}


function dataversesByCategory(config) {
  var colors = config["colors"]["dataverses/byCategory"];
  $.ajax({
    url: dvserver + '/api/info/metrics/dataverses/byCategory' + addAlias(),
    headers: { Accept: "application/json" },
    success: function(data) {
      data = data.data;
      var tileLabel = "Número de " + config.dataverseTerm + "s";
      var visualization = d3plus.viz()
        .data(data)
        .title(config.dataverseTerm + "s por categoría")
        .title({
          "total": true
        })
        .container("#dataverses-by-category")
        .type("tree_map")
        .id("category")
        .size("count")
        .color({
          value: "count",
          heatmap: colors.reverse()
        })
        .format({
          "text": function(text, params) {
            if (text === "count") {
              return tileLabel;
            } else {
              return d3plus.string.title(text, params);
            }
          }
        })
        .legend(false)
        .resize(true);
      if(config.hasOwnProperty("dataversesbycategory.definition")) {
        var explain = config["dataversesbycategory.definition"];
        visualization.footer(config["dataversesbycategory.definition"]);
      }
      visualization.draw();
    }
  });
  $("#dataverses-by-category").append($("<a/>").addClass("button").attr("href", "/api/info/metrics/dataverses/byCategory" + addAlias()).attr("type", "text/csv").text("CSV"));
}

function dataversesBySubject(config) {
  var colors = config["colors"]["dataverses/bySubject"];
  $.ajax({
    url: dvserver + '/api/info/metrics/dataverses/bySubject' + addAlias(),
    headers: { Accept: "application/json" },
    success: function(data) {
      data = data.data;

      var tileLabel = "Número de " + config.dataverseTerm + "s";
      var visualization = d3plus.viz()
        .data(data)
        .title(config.dataverseTerm + "s por materia")
        .title({
          "total": true
        })
        .container("#dataverses-by-subject")
        .type("tree_map")
        .id("subject")
        .size("count")
        .color({
          value: "count",
          heatmap: colors.reverse()
        })
        .format({
          "text": function(text, params) {
            if (text === "count") {
              return tileLabel;
            } else {
              return d3plus.string.title(text, params);
            }
          }
        })
        .legend(false)
        .resize(true);
      if(config.hasOwnProperty("dataversesbysubject.definition")) {
        var explain = config["dataversesbysubject.definition"];
        visualization.footer(config["dataversesbysubject.definition"]);
      }
      visualization.draw();
    }
  });
  $("#dataverses-by-subject").append($("<a/>").addClass("button").attr("href", "/api/info/metrics/dataverses/bySubject" + addAlias()).attr("type", "text/csv").text("CSV"));
}

function datasetsBySubject(config) {
  var colors = config["colors"]["datasets/bySubject"];
  $.ajax({
    url: dvserver + '/api/info/metrics/datasets/bySubject' + addAlias(),
    headers: { Accept: "application/json" },
    success: function(data) {
      data = data.data;

      var tileLabel = "Número de " + config.Term + "s";
      var visualization = d3plus.viz()
        .data(data)
        .title(config.datasetTerm + "s por materia")
        .title({
          "total": true
        })
        .container("#datasets-by-subject")
        .type("tree_map")
        .id("subject")
        .size("count")
        .color({
          value: "count",
          heatmap: colors.reverse()
        })
        .format({
          "text": function(text, params) {
            if (text === "count") {
              return tileLabel;
            } else {
              return d3plus.string.title(text, params);
            }
          }
        })
        .legend(false)
        .resize(true);
      if(config.hasOwnProperty("datasetsbysubject.definition")) {
        var explain = config["datasetsbysubject.definition"];
        visualization.footer(config["datasetsbysubject.definition"]);
      }
      visualization.draw();
    }
  });
  $("#datasets-by-subject").append($("<a/>").addClass("button").attr("href", "/api/info/metrics/datasets/bySubject" + addAlias()).attr("type", "text/csv").text("CSV"));
}

//Retrieves any of the defined Make Data Count metrics
// (the graph itself is the same as other timeseries())
function makeDataCount(metric, config) {
  var color = config["colors"]["makeDataCount/" + metric + "/monthly"];
  $.ajax({
    url: dvserver + '/api/info/metrics/makeDataCount/' + metric + '/monthly' + addAlias(),
    headers: { Accept: "application/json" },
    success: function(data) {

      data = data.data;
      var yLabel = "Número de " + metric;
      var visualization = d3plus.viz()
        .data(data)
        .title("Métricas Make Data Count - " + metric.replace('UniqueDownloads','descargas únicas').replace('Downloads','Descargas').replace('viewsTotal','Visitas totales').replace('','').replace('downloadsTotal','Descargas totales').replace('viewsUnique','Visitas únicas').replace('downloadsUnique','Descargas únicas').replace('Files','Ficheros'))
        .container("#makedatacount-" + metric)
        .type("bar")
        .id("date")
        .x({
          "value": "date",
          "label": "Mes"
        })
        .y({
          "range": [0, data[data.length - 1].count * 1.3],
          "value": "count",
          "label": yLabel.replace('UniqueDownloads','descargas únicas').replace('Downloads','Descargas').replace('viewsTotal','Visitas totales').replace('','').replace('downloadsTotal','Descargas totales').replace('viewsUnique','Visitas únicas').replace('downloadsUnique','Descargas únicas').replace('Files','Ficheros')
        })
        .color(function(d) {
          return color;
        })
        .resize(true);
      if(config.hasOwnProperty("makedatacount." + metric + ".definition")) {
        var explain = config["makedatacount." + metric + ".definition"];
        visualization.footer(config["makedatacount." + metric + ".definition"]);
      }
      visualization.draw();
    }
  });
  $("#makedatacount-" + metric).append($("<a/>").addClass("button").attr("href", "/api/info/metrics/makeDataCount/" + metric + "/monthly" + addAlias()).attr("type", "text/csv").text("CSV"));
}

//Multitimeseries - an array of objects with an additional key that we groupby
//Used for uniquedownloads
function multitimeseries(name, config, groupby) {
  var lcname = name.toLowerCase();
  var color = config["colors"][lcname + "/monthly"];
  $.ajax({
    url: dvserver + '/api/info/metrics/' + lcname + '/monthly' + addAlias(),
    headers: { Accept: "application/json" },
    success: function(data) {

      data = data.data;
      var yLabel = "Número de " + name.replace('UniqueDownloads','Descargas únicas');
      var visualization = d3plus.viz()
        .data(data)
        .title(name.replace('UniqueDownloads','Descargas únicas'))
        .container("#" + lcname)
        .type("stacked")
        .id(groupby)
        .x({
          "value": "date",
          "label": "Mes"
        })
        .y({
          "value": "count",
          "label": yLabel
        })
        .format(function(text){if((typeof text) == 'string') {text = text.replace(/["]+/g,'');} return text;})
        .mouse({
          "click": function(d) {
            window.open(dvserver + "/dataset.xhtml?persistentId=" + JSON.stringify(d.d3plus_data[groupby]).replace(/["]+/g,''), target="_blank");
          }
        })
        .resize(true);
      if(config.hasOwnProperty("multitimeseries." + lcname + ".definition")) {
        var explain = config["multitimeseries." + lcname + ".definition"];
        visualization.footer(config["multitimeseries." + lcname + ".definition"]);
      }
      visualization.draw();
    }
  });
  $("#" + lcname).append($("<a/>").addClass("button").attr("href", "/api/info/metrics/" + lcname + "/monthly" + addAlias()).attr("type", "text/csv").text("CSV"));
}


function filesByType(config) {
  var color = config["colors"]["files/byType"];
  $.ajax({
    url: dvserver + '/api/info/metrics/files/byType' + addAlias(),
    headers: { Accept: "application/json" },
    success: function(data) {
      data = data.data;
      var countVisualization = d3plus.viz()
        .data(data).dev(true)
        .title("Número de ficheros por tipo")
        .container("#files-by-type-count")
        .type("bar")
        .id("contenttype")

        .x({
          "value": "contenttype",
          "label": "Tipo de contenido"
        })
        .y({
          "value": "count",
          "label": "Valor",
          "scale": "linear"
        })
        .order("count")
        .text("contenttype")
        .resize(true);
      if(config.hasOwnProperty("filesbytype.definition")) {
        var explain = config["filesbytype.definition"];
        countVisualization.footer(config["filesbytype.definition"]);
      }
      countVisualization.draw();

      var sizeVisualization = d3plus.viz()
        .data(data.filter(d=>d.size > 0)).dev(true)
        .title("Tamaño de fichero por tipo")
        .container("#files-by-type-size")
        .type("bar")
        .id("contenttype")
        .x({
          "value": "contenttype",
          "label": "Tipo de contenido"
        })
        .y({
          "value": "size",
          "label": "Tamaño total por tipo de fichero",
          "scale": "log"
        })
        .order("size")
        .text("contenttype")
        .resize(true);
      if(config.hasOwnProperty("filesbytype.definition")) {
        var explain = config["filesbytype.definition"];
        sizeVisualization.footer(config["filesbytype.definition"]);
      }
      sizeVisualization.draw();
    }
  });
  $("#files-by-type-count").append($("<a/>").addClass("button").attr("href", "/api/info/metrics/files/byType" + addAlias()).attr("type", "text/csv").text("CSV"));
  $("#files-by-type-size").append($("<span/>").addClass("redundant").attr("title", "Estas métricas están incluidas en el CSV de 'Número de ficheros por tipo'").text("CSV").append($("<span/>").addClass("glyphicon glyphicon-question-sign")));
}

//Shows the unique download count per PID
//The max number of elements (e.g. PIDs) to include can be controlled with the config.maxBars parameter
function uniqueDownloads(config) {
  var color = config["colors"]["downloads/unique"];
  $.ajax({
    url: dvserver + '/api/info/metrics/uniquedownloads' + addAlias(),
    headers: { Accept: "application/json" },
    success: function(data) {
      data = data.data;
      var title = "Descargas únicas por " + config.datasetTerm;
      var maxBars = config["maxBars"];
      if (typeof maxBars !== "undefined") {
        data = data.slice(0, maxBars);
        title = title + " (top " + maxBars + ")";
      }
      var visualization = d3plus.viz()
        .data(data)
        .title(title)
        .container("#uniquedownloads-by-pid")
        .type("bar")
        .id("pid")
        .x({
          "value": "pid",
          "label": "Identificador del " + config.datasetTerm
        })
        .y({
          "value": "count",
          "label": "Descargas únicas",
          "scale": "linear"
        })
        //the API orders the results (so the slice gets the ones with the most counts), but the graph will reorder the without this
        .order("count")
        .text("pid")
        .format(function(text){if((typeof text) == 'string') {text = text.replace(/["]+/g,'');} return text;})
        .mouse({
          "click": function(d) {
            window.open(dvserver + "/dataset.xhtml?persistentId=" + JSON.stringify(d.pid).replace(/["]+/g,''), target="_blank");
          }
        })
        .resize(true);
      if(config.hasOwnProperty("uniquedownloads.definition")) {
        var explain = config["uniquedownloads.definition"];
        visualization.footer(config["uniquedownloads.definition"]);
      }
      visualization.draw();
    }
  });
  $("#uniquedownloads-by-pid").append($("<a/>").addClass("button").attr("href", "/api/info/metrics/uniquedownloads" + addAlias()).attr("type", "text/csv").text("CSV"));
}

//The max number of elements (e.g. PIDs) to include can be controlled with the config.maxBars parameter
function fileDownloads(config) {
  var color = config["colors"]["filedownloads/unique"];
  $.ajax({
    url: dvserver + '/api/info/metrics/filedownloads' + addAlias(),
    headers: { Accept: "application/json" },
    success: function(data) {
      data = data.data;
            var xName = "pid";
            if(data[0].pid.length==0) {
                    xName="id";
            }
      var title = "Descargas por fichero";
      var maxBars = config["maxBars"];
      if (typeof maxBars !== "undefined") {
        data = data.slice(0, maxBars);
        title = title + " (top " + maxBars + ")";
      }
      var visualization = d3plus.viz()
        .data(data)
        .title(title)
        .container("#filedownloads-by-id")
        .type("bar")
        .id("id")
        .x({
          "value": xName,
          "label": "Identificador " + config.datasetTerm
        })
        .y({
          "value": "count",
          "label": "Número de descargas",
          "scale": "linear"
        })
        //the API orders the results (so the slice gets the ones with the most counts), but the graph will reorder the without this
        .order("count")
        .format(function(text){if((typeof text) == 'string') {text = text.replace(/["]+/g,'');} return text;})
        .text(xName)
        .mouse({
          "click": function(d) {
            if(!d.hasOwnProperty("pid") || d.pid.length==0) {
              window.open(dvserver + "/file.xhtml?fileId=" + JSON.stringify(d.id).replace(/["]+/g,''), target="_blank");
            } else {
              window.open(dvserver + "/file.xhtml?persistentId=" + JSON.stringify(d.pid).replace(/["]+/g,''), target="_blank");
            }
          }
        })
        .resize(true);
      if(config.hasOwnProperty("filedownloads.definition")) {
        var explain = config["filedownloads.definition"];
        visualization.footer(config["filedownloads.definition"]);
      }
       visualization.draw();
    }
  });
  $("#filedownloads-by-id").append($("<a/>").addClass("button").attr("href", "/api/info/metrics/filedownloads" + addAlias()).attr("type", "text/csv").text("CSV"));
}


//Add the parentAlias param at the end of URLs if alias is set
function addAlias() {
  return ((alias === null) ? '' : '?parentAlias=' + alias);
}

//Turn dataverse names into links to the metrics page using that dataverse as the parent
function updateNames(node) {
  node.name = "<a href='" + window.location + "?parentAlias=" + node.alias + "'>" + node.alias + "</a>";
  if (typeof node.children !== 'undefined') {
    node.children.forEach((childnode) => {
      updateNames(childnode);
    });
  }
}
