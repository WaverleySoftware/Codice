define([
    'jquery',
    'underscore',
    'backbone',
    'store',
    'd3',
    'text!templates/layout/landing.html',
    'text!templates/layout/landing-cards.html',
    'text!templates/layout/footer.html'
], function($, _, Backbone, Store, d3, LandingTemplate, LandingCardsTemplate, FooterTemplate){
    var TOTAL_GHG_EMISSIONS = 'Total Greenhouse emissions';
    var TOTAL_GHG_EMISSIONS_UNIT = 'kg CO2e';
    var TOTAL_GROSS_FLOOR_AREA_COVERED = 'Total Gross Floor Area Covered';
    var TOTAL_ENERGY_CONSUMPTION = 'Total Energy Consumption';
    var TOTAL_ENERGY_CONSUMPTION_UNIT = '(% kBtu)';
    var TOTAL_BUILDING_REPORTED = 'Total building Reported';
    var SUBMISSIONS_RECEIVED = '% Submissions Received';
    var DATA_COMPLETE_AND_ACCURATE = 'Data Complete and Accurate';

    var Landing = Backbone.View.extend({
        el: '#landing',

        initialize: function(options){
            this.state = options.state;
            this.template = _.template(LandingTemplate);
            this.cardTemplate = _.template(LandingCardsTemplate);
            this.body = $('body');

            // when loader hide, we have all the data
            this.listenTo(this.state, 'hideActivityLoader', this.render);

        },

        events: {
            'click #navigate-further': 'onContinue',
            'click .modal-link': 'onModalLink'
        },

        renderCardsAndHistogram: function () {
            this.getSiteEUI();
            this.$el.find('.landing-main-container--cards').html(
                this.getTotalGhgEmissions() +
                this.getReportedGrossFloorArea() +
                this.getTotalBuildingsReported() +
                this.getTotalEnergyConsumption() +
                this.getSubmissionReceived() +
                this.getDataCompleteAndAccurate()
            );

        },

        onContinue: function() {
            this.body.removeClass('scroll-blocked');
            this.remove();
        },

        onModalLink: function(evt) {
            if (evt.preventDefault) evt.preventDefault();

            // Since this is a modal link, we need to make sure
            // our handler exists
            var modelFn = this.state.get('setModal');
            if (!modelFn) return false;

            modelFn(evt.target.dataset.modal);

            return false;
        },

        getSiteEUI: function () {
            var allbuildings = this.state.get('allbuildings');
            if(allbuildings) {
                var siteEui = allbuildings.map(building => building.get('site_eui')).filter(item => item !== null);
                siteEui = siteEui.reduce((acc, value, i, arr) => {
                    if(i === arr.length - 1) {
                        return (acc + value) / arr.length;
                    }
                    return acc + value;
                }, 0);
            }
        },

        buildD3Histogram: function (data) {
            var margin = {top: 60, right: 30, bottom: 60, left: 60};
            var width = 860 - margin.left - margin.right;
            var height = 400 - margin.top - margin.bottom;

            var title = 'Average Site EUI';
            var titleX = 'Year';

            var svg = d3.select('#landing-histogram')
                .append('svg')
                .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
                .attr('preserveAspectRatio', "xMidYMid meet")
                .append('g')
                .attr('transform',
                    'translate(' + margin.left + ',' + margin.top + ')')

            var x = d3.time.scale()
                .domain(d3.extent(data, (d)=> new Date(d.date)))
                .range([ 0, width ]);
            var y = d3.scale.linear()
                .domain( [0, 100])
                .range([ height, 0 ]);

            // Add X axis --> it is a date format
            svg.append('g')
                .attr('transform', 'translate(0,' + height + ')')
                .attr('class', 'x-axis')
                .call(
                    d3.svg.axis()
                    .scale(x)
                    .orient('bottom')
                    .ticks(12)
                );

            // Add Y axis
            svg.append('g')
                .attr('class', 'y-axis')
                .call(
                    d3.svg.axis()
                    .scale(y)
                    .orient('left')
                    .ticks(10)
                );

            // Add the line
            svg.append('path')
                .datum(data)
                .attr('fill', 'none')
                .attr('stroke', 'steelblue')
                .attr('stroke-width', 1.5)
                .attr('d', d3.svg.line()
                    .x(function(d) { return x(new Date(d.date)) })
                    .y(function(d) { return y(d.value) })
                )

            // Tooltip
            var Tooltip = d3.select('#landing-histogram')
                .append('div')
                .attr('class', 'tooltip')

            var mouseover = function(d) {
                Tooltip
                    .attr('class', 'tooltip tooltip__visible')
            }
            var mousemove = function(d) {
                Tooltip
                    .html(`<div><span>${title}: </span>${d.value}</div><div><span>${titleX}: </span> ${new Date(d.date).getFullYear()}</div>`)
                    .style('left', (d3.mouse(this)[0]) + 'px')
                    .style('top', (d3.mouse(this)[1]) + 'px')
            }
            var mouseleave = function(d) {
                Tooltip
                    .attr('class', 'tooltip')
            }

            // Add the points
            svg
                .append('g')
                .selectAll('dot')
                .data(data)
                .enter()
                .append('circle')
                .attr('cx', function(d) { return x(new Date(d.date)) } )
                .attr('cy', function(d) { return y(d.value) } )
                .attr('r', 10)
                .attr('fill', 'steelblue')
                .on('mouseover', mouseover)
                .on('mousemove', mousemove)
                .on('mouseleave', mouseleave)

            // vertical lines
            svg.selectAll('g.x-axis g.tick')
                .append('line')
                .classed('grid-line', true)
                .attr('x1', 0)
                .attr('y1', 0)
                .attr('x2', 0)
                .attr('y2', -height);

            // horizontal lines
            svg.selectAll('g.y-axis g.tick')
                .append('line')
                .classed('grid-line', true)
                .attr('x1', 0)
                .attr('y1', 0)
                .attr('x2', width)
                .attr('y2', 0);

            svg.append('text')
                .attr('x', (width / 2))
                .attr('y', -20 )
                .attr('text-anchor', 'middle')
                .style('font-size', '1.5em')
                .text(title);

            svg.append('text')
                .attr('x', -(height / 2))
                .attr('y', -(margin.left - 20))
                .attr('text-anchor', 'middle')
                .attr('transform', 'translate(0,0) rotate(270)')
                .style('font-size', '1em')
                .text(`${title} (kBTU/sqft)`);

            svg.append('text')
                .attr('x', width / 2)
                .attr('y', height + (margin.bottom - 10))
                .attr('text-anchor', 'middle')
                .style('font-size', '1em')
                .text(titleX);
        },

        getTotalGhgEmissions: function () {
            var allbuildings = this.state.get('allbuildings');
            if(allbuildings) {
                var totalGhgEmissions = allbuildings.map(building => building.get('total_ghg_emissions')).filter(item => item !== null);
                totalGhgEmissions = totalGhgEmissions.reduce((acc, value) => {
                    return acc + value;
                }, 0);
            }
            return this.cardTemplate({
                title: TOTAL_GHG_EMISSIONS,
                unit: TOTAL_GHG_EMISSIONS_UNIT,
                value: totalGhgEmissions.toFixed(2)
            })
        },

        getReportedGrossFloorArea: function () {
            var allbuildings = this.state.get('allbuildings');
            if(allbuildings) {
                var reportedGrossFloorArea = allbuildings.map(building => building.get('reported_gross_floor_area')).filter(item => item !== null);
                reportedGrossFloorArea = reportedGrossFloorArea.reduce((acc, value) => {
                    return acc + value;
                }, 0);

            }

            return this.cardTemplate({
                title: TOTAL_GROSS_FLOOR_AREA_COVERED,
                unit: '',
                value: reportedGrossFloorArea.toFixed(2)
            })
        },

        getTotalBuildingsReported: function () {
            var allbuildings = this.state.get('allbuildings');

            return this.cardTemplate({
                title: TOTAL_BUILDING_REPORTED,
                unit: '',
                value: allbuildings.length
            })

        },

        getTotalEnergyConsumption: function () {
            var allbuildings = this.state.get('allbuildings');
            if(allbuildings) {
                /**
                 * Needs to find all property_electricityuse_kbtu_* records in each building
                 * then filter from null value
                 * then find sum for each year
                 */
                var totalEnergyConsumption = allbuildings.toArray()
                    .map(item => _.pairs(item.attributes)
                        .map(pair => {
                            if(pair[0].includes('property_electricityuse_kbtu_') && pair[1] !== null) {
                                return pair[1];
                            }
                            return null;
                        })
                        .filter(item => item !== null)
                    )
                    .flat()
                    .reduce((acc, value) => acc + value);
            }

            return this.cardTemplate({
                title: TOTAL_ENERGY_CONSUMPTION,
                unit: TOTAL_ENERGY_CONSUMPTION_UNIT,
                value: totalEnergyConsumption
            })
        },

        getSubmissionReceived: function () {
            return this.cardTemplate({
                title: SUBMISSIONS_RECEIVED,
                unit: '',
                value: 123
            })
        },

        getDataCompleteAndAccurate: function () {
            return this.cardTemplate({
                title: DATA_COMPLETE_AND_ACCURATE,
                unit: '',
                value: 123
            })
        },

        render: function(){
            var city = this.state.get('city');
            this.body.addClass('scroll-blocked');


            this.$el.html(this.template({
                url_name: city.get('url_name'),
                logo_link: city.get('logo_link_url'),
                footer: FooterTemplate
            }));

            this.renderCardsAndHistogram();

            // Histogram should be rendered in the end
            this.buildD3Histogram([
                {date: '2010-01-01', value: 33.2},
                {date: '2011-01-01', value: 38.2},
                {date: '2012-01-01', value: 40.2},
                {date: '2013-01-01', value: 44.2},
                {date: '2014-01-01', value: 51.2},
                {date: '2015-01-01', value: 42.2},
                {date: '2016-01-01', value: 35.2},
                {date: '2017-01-01', value: 48.2},
                {date: '2018-01-01', value: 56.2},
                {date: '2019-01-01', value: 72.2},
                {date: '2020-01-01', value: 97.2},
            ]);

            return this;
        }
    });

    return Landing;
});
