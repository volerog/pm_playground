
var GRAPH_POINTS_COUNT = 30;
var USER_CAPITAL = 100.;

var runned = false;
var itercount = 0;
var users = []
var leaderboard;

// Event detection and probabilities

function detect_event(e, p) {
    if (e.success) {
        if (Math.random() <= p) {
            return 0.99;
        } else {
            return 0.01;
        }
    } else {
        if (Math.random() <= p) {
            return 0.01;
        } else {
            return 0.99;
        }
    }
}

full_random = function(x) {
    if (Math.random() > 0.5) {
        return 0.99;
    } else {
        return 0.01;
    }
}

choice_yes = function(x) {
    return 1;
}

expectation = function(x) {
    return 0.6;
}

detect_event05 = function(e) {return detect_event(e, 0.5);}
detect_event06 = function(e) {return detect_event(e, 0.6);}
detect_event07 = function(e) {return detect_event(e, 0.7);}
detect_event08 = function(e) {return detect_event(e, 0.8);}
detect_event09 = function(e) {return detect_event(e, 0.9);}
detect_event1  = function(e) {return detect_event(e, 1);}

function create_auction() {
    return {success: Math.random()>0.4};
}

// Bots behaviours

var behaviour_depression = function(x, leaderboard, user) {
    if (user.capital < user.params.depression_limit) {
        user.color = "#00f";
        return {sum: 0, p: 0, ok: true};
    }
    return {sum: 0, p: 0, ok: false};
};

var behaviour_greed = function(x, leaderboard, user) {
    current_place = leaderboard.find_place(user.capital);
    if (current_place <= user.params.rich_place) {
        if ((user.prev_place > user.params.rich_place && user.safe_capital < user.capital * user.params.rich_greed) 
          || user.capital < user.safe_capital) {
            user.safe_capital = user.capital * user.params.rich_greed;
        }
        user.color = "#f00";
        return {sum: user.riskable * (user.capital - user.safe_capital), p: user.predictor(x), ok: true};
    }
    user.prev_place = current_place;
    return {sum: 0, p: 0, ok: false};
};

var behaviuor_random = function(x, leaderboard, user) {
    user.color = "#"+((1<<24)*Math.random()|0).toString(16);
    if (user.capital < user.safe_capital) {
        user.safe_capital = user.capital * user.params.rich_greed;
    }
    return {sum: user.riskable * (user.capital - user.safe_capital), p: user.predictor(x), ok: true};
};

// Bots configuration

predictors = {
    'choice_yes'  : choice_yes,
    'expectation'  : expectation,
    'detect0.5' : detect_event05,
    'detect0.6' : detect_event06,
    'detect0.7' : detect_event07,
    'detect0.8' : detect_event08,
    'detect0.9' : detect_event09,
    'detect1' : detect_event1,
    'random' : full_random
}

behs = {
    'depression': behaviour_depression,
    'greed': behaviour_greed,
    'bet': behaviuor_random
}

var user_classes = {
1: {name: 'Hodor', predictor: 'detect0.5', behaviours:['bet'], riskable: 0.3, rich_gredd: 0.7},
    7: {name: 'Joffrey', predictor: 'detect0.5', behaviours:['greed', 'bet'], riskable: 0.3, rich_gredd: 0.7, rich_place: 2},
    9: {name: 'Theon', predictor: 'detect0.5', behaviours:['depression', 'bet'], riskable: 0.3, rich_gredd: 0.7, depression_limit: 20.},
    6: {name: 'Jon Snow', predictor: 'detect0.6', behaviours:['bet'], riskable: 0.3, rich_gredd: 0.7},
    8: {name: 'Jon Snow', predictor: 'detect0.6', behaviours:['depression', 'bet'], riskable: 0.3, rich_gredd: 0.7, depression_limit: 20.},
    10: {name: 'Jon Snow', predictor: 'expectation', behaviours:['depression', 'bet'], riskable: 0.3, rich_gredd: 0.7, depression_limit: 20.},
    5: {name: 'Arya', predictor: 'detect0.7', behaviours:['bet'], riskable: 0.3, rich_gredd: 0.7},
    4: {name: 'Ned', predictor: 'detect0.8', behaviours:['bet'], riskable: 0.3, rich_gredd: 0.7},
    3: {name: 'Robb', predictor: 'detect0.9', behaviours:['bet'], riskable: 0.3, rich_gredd: 0.7},
    2: {name: 'Bran', predictor: 'detect1', behaviours:['bet'], riskable: 0.3, rich_gredd: 0.7}
}

// Engine code

function mk_user_info(user) {
    html = "<div class=\"hero\" id=" + user.id + ">";
    html += user.name;
    html += "<b style=\"position: absolute; width: 50%;\"><div class=\"demo-card-wide mdl-card mdl-shadow--2dp\">";
    html += "<div class=\"mdl-card__title\"><h2 class=\"mdl-card__title-text\">" + JSON.stringify(user.params, null, 4) + "</h2></div>";
    html += "</div></div></b>";
    return html;
}

function mk_bot_button(name, i) {
    html = "<button id=\"botclass" + i + "\" value=\"" + i + "\"";
    html += "class=\"mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect\"";
    html += "title=\"Add " + name + " bot\">"
    html += name;
    html += "<i class=\"material-icons\">add</i></button>";
    return html;
}

function Leaderboard() {

    this.reset_data = function() {
        this.chart = nv.models.lineChart().useInteractiveGuideline(true);
        this.chart.xAxis.axisLabel('Iterations').tickFormat(d3.format(',r'));
        this.chart.yAxis.axisLabel('Capital').tickFormat(d3.format('.02f'));
        this.datum = new Array(users.length);
        $("#bots").html("");
        for (var i = 0; i < users.length; i++) {
            $("#bots").append(mk_user_info(users[i]));
            $("#" + users[i].id).click(function(){
                $(this).find("b").toggle();
            });
            $("#" + users[i].id).find("b").toggle();
            users[i].reset();
            this.datum[i] = {
                values: [],
                key: users[i].name + "(" + i + ")",
                color: "#"+((1<<24)*Math.random()|0).toString(16)
            };
                
            this.datum[i].values.push({x: itercount, y: users[i].capital});
        }
    }

    this.reset_data();

    this.find_place = function(capital) {
        count = 1;
        for (var i = 0; i < users.length; i++) {
            if (users[i].capital > capital) {
                count += 1;
            }
        }
        return count;
    }

    this.redraw = function() {
        var sumcapital = 0;
        for (var i = 0; i < users.length; i++) {
            sumcapital += users[i].capital;
            this.datum[i].values.push({x: itercount, y: users[i].capital});
            this.datum[i].color = users[i].color;
            this.datum[i].key = users[i].name + "(" + i + ")";
        }

        delitem = Math.floor(Math.random() * (GRAPH_POINTS_COUNT*0.9 + 1)) + 1;

        if (this.datum[0].values.length > GRAPH_POINTS_COUNT) {
            for (var i = 0; i < users.length; i++) {
                this.datum[i].values.splice(delitem, 1);
            }
        }

        d3.select('#leaderboard svg')
            .datum(this.datum)
            .transition().duration(500)
            .call(this.chart);

        nv.utils.windowResize(this.chart.update);
        d3.select('#iter-number').text(itercount);
        d3.select('#sum-capital').text(sumcapital);
    };
}


function User(params) {
    this.behaviours = []
    this.name = params.name;
    this.params = params;

    this.id = Math.floor((1 + Math.random()) * 0x10000).toString(16);

    this.predictor = predictors[params.predictor]
    for (var i = 0; i < params.behaviours.length; i++) {
        this.behaviours.push(behs[params.behaviours[i]]);
    }

    this.reset = function() {
        this.capital = USER_CAPITAL;
        this.riskable = params.riskable; // 0. - do nothing, 1. - put everything.
        this.prev_place = 0;
        this.color = "#000";
        this.safe_capital = 0.;
        this.betcount = 0;
        this.successcount = 0;
    }

    this.reset();
   
    this.cs = function(p, s, user) {
        if (p >= 0.99 && s) {
            user.successcount += 1;
        }
        if (p <= 0.09 && !s) {
            user.successcount += 1;
        }
        // $("#" + user.id).html(user.name + ": " + (user.successcount/user.betcount).toFixed(2));
    }

    this.predict = function(x, leaderboard) {
        this.betcount += 1;
        for (var i = 0; i < this.behaviours.length; i++) {
            res = this.behaviours[i](x, leaderboard, this)
            if (res.ok) {
                this.cs(res.p, x.success, this);
                return {"sum": res.sum, "p": res.p}
            } 
        }
        return {"sum": 0, "p": 0};
    }
}

function iter() {
    itercount += 1;
    var auction = create_auction();
    var summ = 0.;
    var summ_win = 0.;
    var bets = new Array(users.length);
    for( var i = 0; i < users.length; i++ ) {
        bet = users[i].predict(auction, leaderboard);
        summ += bet.sum;
        if (auction.success) {
            summ_win += bet.sum * bet.p;
        } else {
            summ_win += bet.sum * (1. - bet.p);
        }
        bets[i] = bet;
    }

    // $("#bets").html(JSON.stringify(bets) + " RESULT = " + auction.success);
    for( var i = 0; i < users.length; i++ ) {
        if (summ_win > 0) {
            if (auction.success) {
                users[i].capital += summ / summ_win * bets[i].sum * bets[i].p;
            } else {
                users[i].capital += summ / summ_win * bets[i].sum * (1. - bets[i].p);
            }
        }
        users[i].capital -= bets[i].sum;
    }
}

function run() {
    iter();
    leaderboard.redraw();
    if (runned) {
        window.setTimeout(run, 100);
    }
}

$(document).ready(function() {
    $("#reset-button").click(function() {
        itercount = 0;
        leaderboard.reset_data();
        leaderboard.redraw();
    });

    $("#play-pause-button").click(function() {
        if (!runned) {
            runned = true;
            run();
        } else {
            runned = false;
        }
    });

    $("#next-step-button").click(function() {
        for (var i = 0 ; i < 200; i++) {
            if (i%7 == 0) {
                leaderboard.redraw();
            }
            iter();
        }
        leaderboard.redraw();
    });

    $("#distribution").click(function() {
        leaderboard.chart2 = nv.models.multiBarChart().stacked(true).showControls(false);
        leaderboard.chart2.xAxis.axisLabel('Hero Places').tickFormat(d3.format(',r'));
        leaderboard.chart2.yAxis.axisLabel('Number').tickFormat(d3.format('.02f'));
        var points = [];
        for (var i = 0 ; i < users.length; i++) {
            points[i] = new Array(users.length + 1);
            for (var j = 0 ; j < users.length + 1; j++) {
                points[i][j] = 0;
            }
        }
        for (var i = 0 ; i < 200; i++) {
            leaderboard.reset_data();
            for (var j = 0 ; j < 200; j++) {
                iter();
            }
            for (var j = 0 ; j < users.length; j++) {
                n = leaderboard.find_place(users[j].capital);
                points[j][n] += 1;
            }
        }
        leaderboard.reset_data();
        datum = new Array(users.length);
        for (var i = 0; i < users.length; i++) {
            datum[i] = {
                values: [],
                key: users[i].name + "(" + i + ")",
                color: "#"+((1<<24)*Math.random()|0).toString(16)
            };
        }
        for (var i = 0 ; i < users.length; i++) {
            for (var j = 0 ; j < users.length + 1; j++) {
                datum[i].values.push({x:j, y:points[i][j]});
            }
        }

        d3.select('#leaderboard2 svg')
            .datum(datum)
            .transition().duration(500)
            .call(leaderboard.chart2);

        nv.utils.windowResize(leaderboard.chart2.update);
    });

    $("#add-bots").click(function() {
        users.push(new User(user_classes[1]))
        leaderboard.reset_data();
        leaderboard.redraw();
    });

    for (var i in  user_classes) {
        $("#botlist").append(mk_bot_button(user_classes[i].name, i));
        $("#botclass" + i + "").click(function() {
            users.push(new User(user_classes[$(this).val()]));
            leaderboard.reset_data();
            leaderboard.redraw();
        });
    }

    $("#remove-bots").click(function() {
        users.splice(users.length - 1, 1);
        leaderboard.reset_data();
        leaderboard.redraw();
    });

    users.push(new User(user_classes[6]))
    users.push(new User(user_classes[7]))
    users.push(new User(user_classes[9]))
    users.push(new User(user_classes[9]))
    users.push(new User(user_classes[9]))
    users.push(new User(user_classes[9]))

    leaderboard = new Leaderboard();
    leaderboard.redraw();
});
