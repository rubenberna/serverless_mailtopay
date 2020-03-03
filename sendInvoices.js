"use strict"
const moment = require('moment');
const job = require('./job');

console.log('Loading function');
const diffDate = moment().subtract(30,'days').format('YYYY-MM-DD')
const currYear = moment().format('YYYY')

// QUERIES

// 1. Main
const mainQuery = `SELECT Id, Startdatum_Contract__c, FirstName, LastName, Email, Phone, MailingAddress, language_lead__c, External_Id__c, Account.Name FROM Contact WHERE (Status__c = 'Geboekt' AND Email!= null AND Startdatum_Contract__c < ${diffDate} AND AccountId='0010Y00000ryjbyQAA' AND Type__c != 'Sollicitant' AND Type__c != 'Strijkklant') AND (Invoice_sent__c = false OR Invoice_year__c < ${currYear})`

// 2. Without filtering those who already received it
const noFilter = `SELECT Id, Startdatum_Contract__c, FirstName, LastName, Email, Phone, MailingAddress, language_lead__c, External_Id__c, Account.Name FROM Contact WHERE (Status__c = 'Geboekt' AND Email!= null AND Startdatum_Contract__c < ${diffDate} AND AccountId='0010Y00000ryjbxQAA' AND Type__c != 'Sollicitant' AND Type__c != 'Strijkklant')`

// 3. Invoice object
const queryLastInvoice = 'SELECT Id, Name, Last_invoice_number__c from Invoice__c'

// 4. Clear invoice information in salesforce contacts
const clearQuery = `SELECT Id FROM Contact WHERE Invoice_sent__c = true`

// 5. Single test query
const testQuery = "SELECT Id, Startdatum_Contract__c, FirstName, LastName, Email, Phone, MailingAddress, language_lead__c, External_Id__c, Account.Name FROM Contact WHERE Email = 'rubenmbernardes@gmail.com'"

let lastInvoiceNumber;

module.exports.handler = (event, context, callback) => {
  let clear = true
  let start = new Date()

  // Diff to run the invoices job or clear the content in salesforce
  const defineJob = () => {
    if (clear) startClear()
    else startJob()
  }

  // Start invoices job
  const startJob = async () => {
    await job.login()
    const records = await job.query(mainQuery)
    const [invoicesQuery] = await job.query(queryLastInvoice)
    lastInvoiceNumber = invoicesQuery.Last_invoice_number__c
    if (records.length) {
      send({ records: records.length })
      processOrder(records)
    }
    else send('No records left')
  }

  // Start clear job for details in salesforce
  const startClear = async () => {
    await job.login()
    const records = await job.query(clearQuery)
    if (records.length) {
      send({ records: records.length })
      processClear(records)
    }
    else send('No records left')
  }

  // Process invoices
  const processOrder = async records => {
    await asyncForEach(records, async (record) => {
      record.invoice_nr = `${currYear}${lastInvoiceNumber}`
      record.OGM = `+++${currYear}/${lastInvoiceNumber}/${record.invoice_nr % 97}+++`
      record.dueDate = `${currYear}-12-31`
      lastInvoiceNumber++
      const res = await job.startInvoice(record)
      console.log(res);
      await job.updateRecordInSalesforce(record)
    })
    job.updateLastInvoiceNr(lastInvoiceNumber)
    let end = new Date() - start
    console.info('Execution time: %dms', end)
  }

  // Process clear job
  const processClear = async records => {
    await asyncForEach(records, async (record) => {
      await job.clearInSalesforce(record)
    })
    let end = new Date() - start
    console.info('Execution time: %dms', end)
  }

  // _helper
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

  defineJob();
}

// serverless invoke local --function SendInvoices
