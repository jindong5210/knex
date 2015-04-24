'use strict';

var tape     = require('tape')
var harness  = require('./harness')

module.exports = function(knex) {

  tape(knex.client.driverName + ' - transactions: before', function(t) {
    knex.schema.dropTableIfExists('test_table')
      .createTable('test_table', function(t) {
        t.integer('id')
        t.string('name')
      })
      .then(function() { 
        t.end() 
      })
  })

  var test = harness('test_table', knex)

  test('transaction', function (t) {
    return knex.transaction(function(trx) {
      return trx.insert({id: 1, name: 'A'}).into('test_table')
    })
    .then(function() {
      return knex.select('*').from('test_table').then(function(results) {
        t.equal(results.length, 1)
      })
    })
  })

  test('transaction rollback', function(t) {
    return knex.transaction(function(trx) {
      return trx.insert({id: 1, name: 'A'}).into('test_table').then(function() {
        throw new Error('Not inserting')
      })
    })
    .catch(function() {})
    .finally(function() {
      return knex.select('*').from('test_table').then(function(results) {
        t.equal(results.length, 0, 'No rows were inserted')
      })
    })
  })

  test('transaction savepoint', function(t) {
    
    return knex.transaction(function(trx) {
      
      return trx.insert({id: 1, name: 'A'}).into('test_table').then(function() {
        
        // Nested transaction (savepoint)
        return trx.transaction(function(trx2) {
          
          // Insert and then roll back the savepoint
          return trx2.table('test_table').insert({id: 2, name: 'B'}).then(function() {
            return trx2('test_table').then(function(results) {
              t.equal(results.length, 2, 'Two Rows inserted')
            })
            .throw(new Error('Rolling Back Savepoint'))
          })

        })

      }).catch(function(err) {
        t.equal(err.message, 'Rolling Back Savepoint')
      })

    })
    .catch(function() {})
    .finally(function() {
      return knex.select('*').from('test_table').then(function(results) {
        t.equal(results.length, 1, 'One row inserted')
      })
    })
  
  })

}
