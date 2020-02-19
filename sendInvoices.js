"use strict"
const moment = require('moment');
const job = require('./job');

console.log('Loading function');
const diffDate = moment().subtract(30,'days').format('YYYY-MM-DD')
const currYear = moment().format('YYYY')
const q = `SELECT Id, Startdatum_Contract__c, FirstName, LastName, Email, Phone, MailingAddress, language_lead__c, External_Id__c, Account.Name FROM Contact WHERE (Status__c = 'Geboekt' AND Email!= null AND Startdatum_Contract__c < ${diffDate} AND AccountId='0010Y00000ryjbxQAA' AND Type__c != 'Sollicitant' AND Type__c != 'Strijkklant') AND (Invoice_sent__c = false OR Invoice_year__c < ${currYear})`

const queryLastInvoice = 'SELECT Id, Name, Last_invoice_number__c from Invoice__c'

const clearQuery = `SELECT Id FROM Contact WHERE Invoice_sent__c = true`

let lastInvoiceNumber;

module.exports.handler = (event, context, callback) => {
  const startJob = async () => {
    await job.login()
    const records = await job.query(q)
    const [invoicesQuery] = await job.query(queryLastInvoice)
    lastInvoiceNumber = invoicesQuery.Last_invoice_number__c
    if (records.length) {
      send({ records: records.length })
      processOrder(records)
    }
    else send('No records left')
  }

  const processOrder = async records => {
    await asyncForEach(records, async (record) => {
      record.invoice_nr = `${currYear}${lastInvoiceNumber}`
      record.OGM = `+++${currYear}/${lastInvoiceNumber}/${record.invoice_nr % 97}+++`
      record.dueDate = `${currYear}-12-31`
      lastInvoiceNumber++
      // await job.startInvoice(record)
      await job.updateRecordInSalesforce(record)
    })
    job.updateLastInvoiceNr(lastInvoiceNumber)
  }

  const asyncForEach = async (array, callback) => {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
  }

  // Final result status
  const send = body => {
    console.log(body);
    callback(null, {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'Origin, X-Requested-With, Content-Type, Accept'
      },
      body: JSON.stringify(body)
    })
  }

  startJob();
}

// serverless invoke local --function SendInvoices
