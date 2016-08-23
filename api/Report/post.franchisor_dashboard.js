var initiateReport = (fromDate, toDate) => {
  var newReport = []

  var numSegments = 12
  var start = fromDate.getTime(),
    end = toDate.getTime(),
    offset = (end - start) / numSegments

  for (var i=0; i<numSegments+1; i++) {
    newReport.push(0)
  }

  return {
    total : 0,
    start: start,
    end : end,
    offset : offset,
    segments : newReport
  }
}

var processReports = (input,generalReport) => {
  input.forEach((item) => {

    var dateCheck = (new Date(item.created_at)).getTime()
    var index = Math.floor((dateCheck - generalReport.start) / generalReport.offset)

    generalReport.total+=1
    generalReport.segments[index]+=1
  })

}

module.exports = (req,res,next) => {

  var toDate = req.body["end-date"] ? new Date(req.body["end-date"]) : new Date()
  var fromDate = req.body["start-date"] ? new Date(req.body["start-date"]) : new Date(0)

  var leadQuery = {
      where: {
          created_at: {
              $lt: toDate,
              $gt: fromDate
          }
      },
      order: 'FranchiseeRequest.created_at DESC'
  }

  leadQuery.include = [{
    model: req.model.Franchise,
    attributes : ['id','name', 'description'],
    include: [
      {
        model: req.model.FranchiseUser,
        where: {id: req.token.user_id},
        required: true,
      }
    ]
  }]

  var promises = []

  promises.push(req.model.FranchiseeRequest.findAll(leadQuery))

  Promise
  .all(promises)
  .then((allResults) => {

    var leadReports = initiateReport(fromDate,toDate);

    var lowArray = [];
    var topArray = [];
    var expArray = [];

    allResults.forEach((queryResult) => {
      if (queryResult && queryResult.length) {
        switch (queryResult[0].$modelOptions.name.singular) {
          case 'FranchiseeRequest':
            processReports(queryResult,leadReports);
            break;
          case 'Franchise' :
            processFranchise(queryResult, topArray, lowArray, expArray);
        }
      }
    })

    return res.status(200).json({
      leads : leadReports,
      topArray : topArray,
      lowArray : lowArray,
      expArray : expArray
    })

    // return res.status(200).json(allResults)
  })
  .catch((err) => {
    return res.status(500).json(err)
  })
}
