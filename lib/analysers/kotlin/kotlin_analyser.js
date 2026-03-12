/*
 * code-forensics
 * Copyright (C) 2016-2021 Silvio Montanari
 * Distributed under the GNU General Public License v3.0
 * see http://www.gnu.org/licenses/gpl.html
 */

var _             = require('lodash'),
    Parser        = require('tree-sitter'),
    Kotlin        = require('tree-sitter-kotlin'),
    StringDecoder = require('string_decoder').StringDecoder,
    logger        = require('../../log'),
    utils         = require('../../utils');

var decoder = new StringDecoder();

module.exports = function() {
  var parser = new Parser();
  parser.setLanguage(Kotlin);

  var cyclomaticComplexity = function(code) {
    var tree = parser.parse(code);
    var complexity = 1;

    function visit(node) {
      var type = node.type;
      // Decision points for Kotlin
      if (["if_expression", "when_expression", "for_statement", "while_statement", "do_while_statement", "catch_block", "elvis_expression", "conjunction_expression", "disjunction_expression"].includes(type)) {
        complexity++;
      }
      
      for (var i = 0; i < node.namedChildCount; i++) {
        visit(node.namedChild(i));
      }
    }

    visit(tree.rootNode);
    return complexity;
  };

  var analyse = function(filepath, content, transformFn, onError) {
    try {
      var code = decoder.write(content);
      var cc = cyclomaticComplexity(code);
      
      var complexityReport = {
        path: filepath,
        totalComplexity: cc,
        averageComplexity: cc,
        methodComplexity: [] // Not implementing method-level yet for Kotlin
      };

      if (_.isFunction(transformFn)) {
        return transformFn(complexityReport);
      }
      return complexityReport;
    } catch(e) {
      onError(e);
    }
  };

  this.sourceAnalysisStream = function(filepath, transformFn) {
    return utils.stream.reduceToObjectStream(function(content) {
      return analyse(filepath, content, transformFn, function(e) {
        logger.error('Error analysing content: ' + e.message);
      });
    });
  };

  this.fileAnalysisStream = function(filepath, transformFn) {
    logger.info('Analysing ', filepath);
    return utils.stream.readFileToObjectStream(filepath, function(content) {
      return analyse(filepath, content, transformFn, function(e) {
        logger.error('Error analysing ' + filepath + ': ' + e.message);
      });
    });
  };
};
