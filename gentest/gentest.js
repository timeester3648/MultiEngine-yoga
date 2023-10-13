/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-env browser */
/* global CPPEmitter:readable, JavaEmitter:readable, JavascriptEmitter:readable */

const DEFAULT_EXPERIMENTS = ['AbsolutePercentageAgainstPaddingEdge'];

window.onload = function () {
  checkDefaultValues();

  printTest(
    new CPPEmitter(),
    'cpp',
    document.body.children[0],
    document.body.children[1],
    document.body.children[2],
  );

  printTest(
    new JavaEmitter(),
    'java',
    document.body.children[0],
    document.body.children[1],
    document.body.children[2],
  );

  printTest(
    new JavascriptEmitter(),
    'js',
    document.body.children[0],
    document.body.children[1],
    document.body.children[2],
  );
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function printTest(e, ext, LTRContainer, RTLContainer, genericContainer) {
  e.push([
    ext === 'js' ? '/**' : '/*',
    ' * Copyright (c) Meta Platforms, Inc. and affiliates.',
    ' *',
    ' * This source code is licensed under the MIT license found in the',
    ' * LICENSE file in the root directory of this source tree.',
    ' */',
    ext === 'cpp' ? '\n// clang-format off' : '',
    '// @' +
      'generated by gentest/gentest.rb from gentest/fixtures/' +
      document.title +
      '.html',
    '',
  ]);
  e.emitPrologue();

  const LTRLayoutTree = calculateTree(LTRContainer);
  const RTLLayoutTree = calculateTree(RTLContainer);
  const genericLayoutTree = calculateTree(genericContainer);

  for (let i = 0; i < genericLayoutTree.length; i++) {
    e.emitTestPrologue(
      genericLayoutTree[i].name,
      genericLayoutTree[i].experiments,
      genericLayoutTree[i].disabled,
    );

    if (genericLayoutTree[i].name == 'wrap_column') {
      // Modify width and left values due to both safari and chrome not abiding by the
      // specification. The undefined dimension of a parent should be defined by the total size
      // of their children in that dimension.
      // See diagram under flex-wrap header https://www.w3.org/TR/css-flexbox-1/
      assert(
        LTRLayoutTree[0].width == 30,
        'wrap_column LTR root.width should be 30',
      );
      LTRLayoutTree[0].width = 60;
      assert(
        RTLLayoutTree[0].width == 30,
        'wrap_column RTL root.width should be 30',
      );
      RTLLayoutTree[0].width = 60;
      const children = RTLLayoutTree[0].children;
      assert(
        children[0].left == 0,
        'wrap_column RTL root_child0.left should be 0',
      );
      children[0].left = 30;
      assert(
        children[1].left == 0,
        'wrap_column RTL root_child0.left should be 0',
      );
      children[1].left = 30;
      assert(
        children[2].left == 0,
        'wrap_column RTL root_child2.left should be 0',
      );
      children[2].left = 30;
      assert(
        children[3].left == -30,
        'wrap_column RTL root_child3.left should be -30',
      );
      children[3].left = 0;
    }

    setupTestTree(
      e,
      undefined,
      LTRLayoutTree[i],
      genericLayoutTree[i],
      'root',
      null,
    );

    e.YGNodeCalculateLayout(
      'root',
      e.YGDirectionLTR,
      genericLayoutTree[i].experiments,
    );
    e.push('');

    assertTestTree(e, LTRLayoutTree[i], 'root', null);
    e.push('');

    e.YGNodeCalculateLayout(
      'root',
      e.YGDirectionRTL,
      genericLayoutTree[i].experiments,
    );
    e.push('');

    assertTestTree(e, RTLLayoutTree[i], 'root', null);

    e.emitTestEpilogue(genericLayoutTree[i].experiments);
  }
  e.emitEpilogue();

  e.print();
}

function assertTestTree(e, node, nodeName, _parentName) {
  e.AssertEQ(node.left, e.YGNodeLayoutGetLeft(nodeName));
  e.AssertEQ(node.top, e.YGNodeLayoutGetTop(nodeName));
  e.AssertEQ(node.width, e.YGNodeLayoutGetWidth(nodeName));
  e.AssertEQ(node.height, e.YGNodeLayoutGetHeight(nodeName));

  for (let i = 0; i < node.children.length; i++) {
    e.push('');
    const childName = nodeName + '_child' + i;
    assertTestTree(e, node.children[i], childName, nodeName);
  }
}

function checkDefaultValues() {
  // Sanity check of the Yoga default values by test-template.html
  [
    {style: 'flex-direction', value: 'column'},
    {style: 'justify-content', value: 'flex-start'},
    {style: 'align-content', value: 'flex-start'},
    {style: 'align-items', value: 'stretch'},
    {style: 'position', value: 'relative'},
    {style: 'flex-wrap', value: 'nowrap'},
    {style: 'overflow', value: 'visible'},
    {style: 'flex-grow', value: '0'},
    {style: 'flex-shrink', value: '0'},
    {style: 'left', value: 'undefined'},
    {style: 'top', value: 'undefined'},
    {style: 'right', value: 'undefined'},
    {style: 'bottom', value: 'undefined'},
    {style: 'display', value: 'flex'},
  ].forEach(item => {
    assert(
      isDefaultStyleValue(item.style, item.value),
      item.style + ' should be ' + item.value,
    );
  });
}

function setupTestTree(
  e,
  parent,
  node,
  genericNode,
  nodeName,
  parentName,
  index,
) {
  e.emitTestTreePrologue(nodeName);

  for (const style in node.style) {
    // Skip position info for root as it messes up tests
    if (
      node.declaredStyle[style] === '' &&
      (style == 'position' ||
        style == 'left' ||
        style == 'top' ||
        style == 'right' ||
        style == 'bottom' ||
        style == 'width' ||
        style == 'height')
    ) {
      continue;
    }

    if (!isDefaultStyleValue(style, node.style[style])) {
      switch (style) {
        case 'aspect-ratio':
          e.YGNodeStyleSetAspectRatio(
            nodeName,
            pointValue(e, node.style[style]),
          );
          break;
        case 'gap':
          e.YGNodeStyleSetGap(
            nodeName,
            e.YGGutterAll,
            pointValue(e, node.style[style]),
          );
          break;
        case 'column-gap':
          e.YGNodeStyleSetGap(
            nodeName,
            e.YGGutterColumn,
            pointValue(e, node.style[style]),
          );
          break;
        case 'row-gap':
          e.YGNodeStyleSetGap(
            nodeName,
            e.YGGutterRow,
            pointValue(e, node.style[style]),
          );
          break;
        case 'direction':
          e.YGNodeStyleSetDirection(
            nodeName,
            directionValue(e, node.style[style]),
          );
          break;
        case 'flex-direction':
          e.YGNodeStyleSetFlexDirection(
            nodeName,
            flexDirectionValue(e, node.style[style]),
          );
          break;
        case 'justify-content':
          e.YGNodeStyleSetJustifyContent(
            nodeName,
            justifyValue(e, node.style[style]),
          );
          break;
        case 'align-content':
          e.YGNodeStyleSetAlignContent(
            nodeName,
            alignValue(e, node.style[style]),
          );
          break;
        case 'align-items':
          e.YGNodeStyleSetAlignItems(
            nodeName,
            alignValue(e, node.style[style]),
          );
          break;
        case 'align-self':
          if (!parent || node.style[style] !== parent.style['align-items']) {
            e.YGNodeStyleSetAlignSelf(
              nodeName,
              alignValue(e, node.style[style]),
            );
          }
          break;
        case 'position':
          e.YGNodeStyleSetPositionType(
            nodeName,
            positionValue(e, node.style[style]),
          );
          break;
        case 'flex-wrap':
          e.YGNodeStyleSetFlexWrap(nodeName, wrapValue(e, node.style[style]));
          break;
        case 'overflow':
          e.YGNodeStyleSetOverflow(
            nodeName,
            overflowValue(e, node.style[style]),
          );
          break;
        case 'flex-grow':
          e.YGNodeStyleSetFlexGrow(nodeName, node.style[style]);
          break;
        case 'flex-shrink':
          e.YGNodeStyleSetFlexShrink(nodeName, node.style[style]);
          break;
        case 'flex-basis':
          e.YGNodeStyleSetFlexBasis(nodeName, pointValue(e, node.style[style]));
          break;
        case 'left':
          if (genericNode.rawStyle.indexOf('start:') >= 0) {
            e.YGNodeStyleSetPosition(
              nodeName,
              e.YGEdgeStart,
              pointValue(e, node.style[style]),
            );
          } else {
            e.YGNodeStyleSetPosition(
              nodeName,
              e.YGEdgeLeft,
              pointValue(e, node.style[style]),
            );
          }
          break;
        case 'top':
          e.YGNodeStyleSetPosition(
            nodeName,
            e.YGEdgeTop,
            pointValue(e, node.style[style]),
          );
          break;
        case 'right':
          if (genericNode.rawStyle.indexOf('end:') >= 0) {
            e.YGNodeStyleSetPosition(
              nodeName,
              e.YGEdgeEnd,
              pointValue(e, node.style[style]),
            );
          } else {
            e.YGNodeStyleSetPosition(
              nodeName,
              e.YGEdgeRight,
              pointValue(e, node.style[style]),
            );
          }
          break;
        case 'bottom':
          e.YGNodeStyleSetPosition(
            nodeName,
            e.YGEdgeBottom,
            pointValue(e, node.style[style]),
          );
          break;
        case 'margin-left':
          if (genericNode.rawStyle.indexOf('margin-start:') >= 0) {
            e.YGNodeStyleSetMargin(
              nodeName,
              e.YGEdgeStart,
              pointValue(e, node.style[style]),
            );
          } else {
            e.YGNodeStyleSetMargin(
              nodeName,
              e.YGEdgeLeft,
              pointValue(e, node.style[style]),
            );
          }
          break;
        case 'margin-top':
          e.YGNodeStyleSetMargin(
            nodeName,
            e.YGEdgeTop,
            pointValue(e, node.style[style]),
          );
          break;
        case 'margin-right':
          if (genericNode.rawStyle.indexOf('margin-end:') >= 0) {
            e.YGNodeStyleSetMargin(
              nodeName,
              e.YGEdgeEnd,
              pointValue(e, node.style[style]),
            );
          } else {
            e.YGNodeStyleSetMargin(
              nodeName,
              e.YGEdgeRight,
              pointValue(e, node.style[style]),
            );
          }
          break;
        case 'margin-bottom':
          e.YGNodeStyleSetMargin(
            nodeName,
            e.YGEdgeBottom,
            pointValue(e, node.style[style]),
          );
          break;
        case 'padding-left':
          if (genericNode.rawStyle.indexOf('padding-start:') >= 0) {
            e.YGNodeStyleSetPadding(
              nodeName,
              e.YGEdgeStart,
              pointValue(e, node.style[style]),
            );
          } else {
            e.YGNodeStyleSetPadding(
              nodeName,
              e.YGEdgeLeft,
              pointValue(e, node.style[style]),
            );
          }
          break;
        case 'padding-top':
          e.YGNodeStyleSetPadding(
            nodeName,
            e.YGEdgeTop,
            pointValue(e, node.style[style]),
          );
          break;
        case 'padding-right':
          if (genericNode.rawStyle.indexOf('padding-end:') >= 0) {
            e.YGNodeStyleSetPadding(
              nodeName,
              e.YGEdgeEnd,
              pointValue(e, node.style[style]),
            );
          } else {
            e.YGNodeStyleSetPadding(
              nodeName,
              e.YGEdgeRight,
              pointValue(e, node.style[style]),
            );
          }
          break;
        case 'padding-bottom':
          e.YGNodeStyleSetPadding(
            nodeName,
            e.YGEdgeBottom,
            pointValue(e, node.style[style]),
          );
          break;
        case 'border-left-width':
          if (genericNode.rawStyle.indexOf('border-start-width:') >= 0) {
            e.YGNodeStyleSetBorder(
              nodeName,
              e.YGEdgeStart,
              pointValue(e, node.style[style]),
            );
          } else {
            e.YGNodeStyleSetBorder(
              nodeName,
              e.YGEdgeLeft,
              pointValue(e, node.style[style]),
            );
          }
          break;
        case 'border-top-width':
          e.YGNodeStyleSetBorder(
            nodeName,
            e.YGEdgeTop,
            pointValue(e, node.style[style]),
          );
          break;
        case 'border-right-width':
          if (genericNode.rawStyle.indexOf('border-end-width:') >= 0) {
            e.YGNodeStyleSetBorder(
              nodeName,
              e.YGEdgeEnd,
              pointValue(e, node.style[style]),
            );
          } else {
            e.YGNodeStyleSetBorder(
              nodeName,
              e.YGEdgeRight,
              pointValue(e, node.style[style]),
            );
          }
          break;
        case 'border-bottom-width':
          e.YGNodeStyleSetBorder(
            nodeName,
            e.YGEdgeBottom,
            pointValue(e, node.style[style]),
          );
          break;
        case 'width':
          e.YGNodeStyleSetWidth(nodeName, pointValue(e, node.style[style]));
          break;
        case 'min-width':
          e.YGNodeStyleSetMinWidth(nodeName, pointValue(e, node.style[style]));
          break;
        case 'max-width':
          e.YGNodeStyleSetMaxWidth(nodeName, pointValue(e, node.style[style]));
          break;
        case 'height':
          e.YGNodeStyleSetHeight(nodeName, pointValue(e, node.style[style]));
          break;
        case 'min-height':
          e.YGNodeStyleSetMinHeight(nodeName, pointValue(e, node.style[style]));
          break;
        case 'max-height':
          e.YGNodeStyleSetMaxHeight(nodeName, pointValue(e, node.style[style]));
          break;
        case 'display':
          e.YGNodeStyleSetDisplay(nodeName, displayValue(e, node.style[style]));
          break;
      }
    }
  }

  if (parentName) {
    e.YGNodeInsertChild(parentName, nodeName, index);
  }

  for (let i = 0; i < node.children.length; i++) {
    e.push('');
    const childName = nodeName + '_child' + i;
    setupTestTree(
      e,
      node,
      node.children[i],
      genericNode.children[i],
      childName,
      nodeName,
      i,
    );
  }
}

function overflowValue(e, value) {
  switch (value) {
    case 'visible':
      return e.YGOverflowVisible;
    case 'hidden':
      return e.YGOverflowHidden;
    case 'scroll':
      return e.YGOverflowScroll;
  }
}

function wrapValue(e, value) {
  switch (value) {
    case 'wrap':
      return e.YGWrapWrap;
    case 'wrap-reverse':
      return e.YGWrapWrapReverse;
    case 'nowrap':
      return e.YGWrapNoWrap;
  }
}

function flexDirectionValue(e, value) {
  switch (value) {
    case 'row':
      return e.YGFlexDirectionRow;
    case 'row-reverse':
      return e.YGFlexDirectionRowReverse;
    case 'column':
      return e.YGFlexDirectionColumn;
    case 'column-reverse':
      return e.YGFlexDirectionColumnReverse;
  }
}

function justifyValue(e, value) {
  switch (value) {
    case 'center':
      return e.YGJustifyCenter;
    case 'space-around':
      return e.YGJustifySpaceAround;
    case 'space-between':
      return e.YGJustifySpaceBetween;
    case 'space-evenly':
      return e.YGJustifySpaceEvenly;
    case 'flex-start':
      return e.YGJustifyFlexStart;
    case 'flex-end':
      return e.YGJustifyFlexEnd;
  }
}

function positionValue(e, value) {
  switch (value) {
    case 'absolute':
      return e.YGPositionTypeAbsolute;
    default:
      return e.YGPositionTypeRelative;
  }
}

function directionValue(e, value) {
  switch (value) {
    case 'ltr':
      return e.YGDirectionLTR;
    case 'rtl':
      return e.YGDirectionRTL;
    case 'inherit':
      return e.YGDirectionInherit;
  }
}

function alignValue(e, value) {
  switch (value) {
    case 'auto':
      return e.YGAlignAuto;
    case 'center':
      return e.YGAlignCenter;
    case 'stretch':
      return e.YGAlignStretch;
    case 'flex-start':
      return e.YGAlignFlexStart;
    case 'flex-end':
      return e.YGAlignFlexEnd;
    case 'space-between':
      return e.YGAlignSpaceBetween;
    case 'space-around':
      return e.YGAlignSpaceAround;
    case 'baseline':
      return e.YGAlignBaseline;
  }
}

function pointValue(e, value) {
  switch (value) {
    case 'auto':
      return e.YGAuto;
    case 'undefined':
      return e.YGUndefined;
    default:
      return value;
  }
}

function displayValue(e, value) {
  switch (value) {
    case 'flex':
      return e.YGDisplayFlex;
    case 'none':
      return e.YGDisplayNone;
  }
}

const DEFAULT_STYLES = new Map();

function isDefaultStyleValue(style, value) {
  let defaultStyle = DEFAULT_STYLES.get(style);
  if (defaultStyle == null) {
    switch (style) {
      case 'position':
        defaultStyle = new Set(['relative']);
        break;

      case 'left':
      case 'top':
      case 'right':
      case 'bottom':
      case 'start':
      case 'end':
        defaultStyle = new Set(['undefined']);
        break;

      case 'min-height':
      case 'min-width':
        defaultStyle = new Set(['0', '0px', 'auto']);
        break;

      default: {
        const node = document.getElementById('default');
        defaultStyle = new Set([getComputedStyle(node, null)[style]]);
        break;
      }
    }
    DEFAULT_STYLES.set(style, defaultStyle);
  }
  return DEFAULT_STYLES.get(style).has(value);
}

function getRoundedSize(node) {
  const boundingRect = node.getBoundingClientRect();
  return {
    width: Math.round(boundingRect.right) - Math.round(boundingRect.left),
    height: Math.round(boundingRect.bottom) - Math.round(boundingRect.top),
  };
}

function calculateTree(root, roundToPixelGrid) {
  const rootLayout = [];

  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i];
    const layout = {
      name: child.id !== '' ? child.id : 'INSERT_NAME_HERE',
      left: child.offsetLeft + child.parentNode.clientLeft,
      top: child.offsetTop + child.parentNode.clientTop,
      width: child.offsetWidth,
      height: child.offsetHeight,
      children: calculateTree(child, roundToPixelGrid),
      style: getYogaStyle(child),
      declaredStyle: child.style,
      rawStyle: child.getAttribute('style'),
      experiments: child.dataset.experiments
        ? child.dataset.experiments.split(' ')
        : DEFAULT_EXPERIMENTS,
      disabled: child.dataset.disabled === 'true',
    };

    const size = getRoundedSize(child);
    layout.width = size.width;
    layout.height = size.height;

    rootLayout.push(layout);
  }

  return rootLayout;
}

function getYogaStyle(node) {
  // TODO: Relying on computed style means we cannot test shorthand props like
  // "padding", "margin", "gap", or negative values.
  return [
    'direction',
    'flex-direction',
    'justify-content',
    'align-content',
    'align-items',
    'align-self',
    'position',
    'flex-wrap',
    'overflow',
    'flex-grow',
    'flex-shrink',
    'flex-basis',
    'left',
    'top',
    'right',
    'bottom',
    'margin-left',
    'margin-top',
    'margin-right',
    'margin-bottom',
    'padding-left',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'border-left-width',
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'width',
    'min-width',
    'max-width',
    'height',
    'min-height',
    'max-height',
    'column-gap',
    'row-gap',
    'display',
    'aspect-ratio',
  ].reduce((map, key) => {
    map[key] =
      node.style[key] || getComputedStyle(node, null).getPropertyValue(key);
    return map;
  }, {});
}

const Emitter = function (lang, indent) {
  this.lang = lang;
  this.indent = indent;
  this.indents = [];
  this.lines = [];
};

Emitter.prototype = Object.create(Object.prototype, {
  constructor: {value: Emitter},

  pushIndent: {
    value: function () {
      this.indents.push(this.indent);
    },
  },

  popIndent: {
    value: function () {
      this.indents.pop();
    },
  },

  push: {
    value: function (line) {
      if (line instanceof Array) {
        line.forEach(function (element) {
          this.push(element);
        }, this);
        return;
      } else if (line.length > 0) {
        line = this.indents.join('') + line;
      }
      this.lines.push(line);
    },
  },

  print: {
    value: function () {
      console.log(this.lines.join('\n'));
    },
  },
});
