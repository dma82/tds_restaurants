var app = angular.module("myApp", []);

// Requests go to the server that is running locally
app.controller("myCtrl", function($scope, $http) {
    $scope.resultsFound = 0;

    $('#dateTimePicker').datetimepicker({
        format : 'DD/MM/YYYY HH:mm'
    });

    $scope.setDateTime = function () { 
        $("#dateTimePicker").datetimepicker().on("dp.change", function (data) {
            $scope.selectedDt = data.date._d;
        });
    }
    
    $scope.search = function(){
        let selectedDate = moment($scope.selectedDt);
        // Days in Javascript start from Monday but on MySQL start from Sunday, so need to convert this value into MySQL
        let day_of_week = (selectedDate.isoWeekday() + 1 % 7);
        let open_time = selectedDate.format("HH:mm");
        
        $http.post('http://localhost:3100/search.json', 
                    JSON.stringify({ "dayOfWeek": day_of_week, "openAt": open_time })
        )
        .then(function(response) {
            $scope.result = response.data.result;
            $scope.resultsFound = response.data.result.length;
            if ($scope.resultsFound === 0){
                $("#noResults").text("No restaurants opened");
            }
            else $("#noResults").text("");
        }).catch(function (data) {
            console.log("ERROR:", data);
        });
    }
    
});