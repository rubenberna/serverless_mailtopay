const jsforce = require('jsforce');
const moment = require('moment');
const org = new jsforce.Connection();
const mailtopayApi = require('./mailtopayApi')
const convert = require('xml-js')
const builder = require('xmlbuilder');

const { SF_PASSWORD, SF_USERNAME } = process.env;

let conn;

const login = async () => {
  await org.login(SF_USERNAME, SF_PASSWORD, function (err, userInfo) {
    if (err) console.log(err);
    else return conn = org;
  });
};

const authCheck = async () => {
  const check = await mailtopayApi.get('authcheck/')
  console.log(check);
}

const searchFlows = async () => {
  const flows = await mailtopayApi.get('flows/')
  const res = convert.xml2json(flows.data, { compact: true, spaces: 2})
  return res
}

const startInvoice = async record => {

  let date = new Date()
  let atomicDate = date.toISOString()

  let invoiceObj = {
    'request': {
      'firstname': record.FirstName,
      'lastname': record.LastName,
      'emailaddress1': record.Email,
      'emailaddress2': '',
      'telephone1': record.Phone,
      'telephone2': '',
      'address_street': record.MailingAddress.street,
      'address_number': '',
      'address_postcode': record.MailingAddress.postalCode,
      'address_city': record.MailingAddress.city,
      'address_country': record.MailingAddress.country,
      'address_street2': '',
      'address_number2': '',
      'address_postcode2': '',
      'address_city2': '',
      'address_country2': '',
      'id_request_client': '',
      'company_name': 'EasyLife',
      'birth_date': '',
      'gender': 1,
      'variable1': '',
      'variable2': '',
      'variable3': '',
      'variable4': '',
      'variable5': '',
      'username': '',
      'flow_datetime': atomicDate,
      'module_ideal': 0,
      'module_paypal': 0,
      'module_creditcard': 0,
      'language': record.language_lead__c || 'nl',
      'debtornumber': record.External_Id__c,
      'payment_reference': `${record.External_Id__c}${+new Date()}`,
      'concerning': 'admin fee',
      'id_batch': +new Date(),
      'flow_id': 4547,
      'flow_step': 1,
      'invoices': {
        'invoice': {
          'invoice_number': record.invoice_nr,
          'invoice_date': moment().format('YYYY-MM-DD'),
          'invoice_description': 'Email invoice',
          'invoice_amount': 35,
          'invoice_date_due': record.dueDate
        }
      }
    }
  };

  var xmlObj = builder.create(invoiceObj, { encoding: 'utf-8' })
  const invoice = await sendOrder(xmlObj.end({ pretty: true }))
  return invoice
}

const sendOrder = async xmlInvoice => {
  const res = await mailtopayApi.post('collectionorders/', xmlInvoice )
  return res.data
}


const query = async q => {
  try {
    const result = await conn.query(q);
    return result.records;
  } catch (error) {
    return error;
  }
};

const updateRecordInSalesforce = async record => {
  const currYear = moment().format('YYYY')
  conn.sobject('Contact').update({
    Id: record.Id,
    Invoice_sent__c: true,
    Invoice_year__c: currYear,
    Invoiced_date__c: moment().format('YYYY-MM-DD'),
    Invoice_amount__c: 35,
    Invoice_date_due__c: record.dueDate,
    Invoice_OGM__c: record.OGM,
    Invoice_number__c: record.invoice_nr
  }, (err, ret) => {
    if (err || !ret.success) console.log("error: ", err);
    else console.log("success: ", ret.id);
  })
  return
}

const clearInSalesforce = async record => {
  conn.sobject('Contact').update({
    Id: record.Id,
    Invoice_sent__c: false,
    Invoice_year__c: null,
    Invoiced_date__c: null,
    Invoice_amount__c: null,
    Invoice_date_due__c: null,
    Invoice_OGM__c: null,
    Invoice_number__c: null
  }, (err, ret) => {
    if (err || !ret.success) console.log("error: ", err);
    else console.log("success: ", ret.id);
  })
  return
}

const updateLastInvoiceNr = async (lastNr) => {
  await conn.sobject('Invoice__c').update({
    Id: 'a0L1v00000N953BEAR',
    Last_invoice_number__c: lastNr
  }, (err, ret) => {
    if (err || !ret.success) console.log("error: ", err)
    else console.log("success: ", ret.id)
  })
}


module.exports = {
  login,
  query,
  authCheck,
  searchFlows,
  startInvoice,
  updateRecordInSalesforce,
  updateLastInvoiceNr,
  clearInSalesforce
};
