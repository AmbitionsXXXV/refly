import classNames from 'classnames';
import { useEffect, useRef } from 'react';
import type { Mark, MarkScope, SyncMarkEvent, SyncMarkEventType, SyncStatusEvent } from '@refly/common-types';
import { safeStringifyJSON } from '@refly-packages/utils/parse';
import {
  BackgroundMessage,
  sendMessage,
  onMessage,
} from '@refly-packages/ai-workspace-common/utils/extension/messaging';
import { getRuntime } from '@refly-packages/ai-workspace-common/utils/env';
import { SelectedNamespace } from '@refly-packages/ai-workspace-common/stores/knowledge-base';
// import { getContentFromHtmlSelector } from "@/utils/weblink"
import { getElementType } from '../utils';
import { genContentSelectorID } from '@refly-packages/utils/id';
import { getMarkdown } from '@refly/utils/html2md';
import { BLOCK_SELECTED_MARK_ID, INLINE_SELECTED_MARK_ID } from '../utils/index';
import { removeHighlight } from '../utils/highlight-selection';

// utils
import { highlightSelection, getSelectionNodesMarkdown } from '../utils/highlight-selection';
import { ElementType } from '../utils';

export const useContentSelector = (selector: string | null, namespace: SelectedNamespace) => {
  const statusRef = useRef(true);
  const markRef = useRef<HTMLDivElement>(undefined);
  const targetList = useRef<Element[]>([]);
  const markListRef = useRef<Mark[]>([]);
  const showContentSelectorRef = useRef<boolean>(false);
  const messageListenerEventRef = useRef<any>();
  const selectorScopeRef = useRef<MarkScope>('block');

  const buildMark = (type: ElementType, content: string, xPath: string) => {
    const mark: Mark = {
      type,
      data: content,
      xPath,
      scope: selectorScopeRef.current,
    };

    return mark;
  };

  const addMark = (mark: Mark, target: HTMLElement | HTMLElement[]) => {
    markListRef.current = markListRef.current.concat(mark);
    // 添加到 list 方便后续统一的处理
    targetList.current = targetList.current.concat(target as Element);
  };

  const addInlineMark = () => {
    const xPath = genContentSelectorID();
    const content = getSelectionNodesMarkdown();
    const selectionNodes = highlightSelection(xPath);

    const type = 'text' as ElementType;
    const mark = buildMark(type, content, xPath);
    addMark(mark, selectionNodes);

    return mark;
  };

  const addBlockMark = (target: HTMLElement) => {
    const type = getElementType(target);
    const xPath = genContentSelectorID();
    target.setAttribute(BLOCK_SELECTED_MARK_ID, xPath);
    const mark = buildMark(type, getMarkdown(target as HTMLElement), xPath);
    addMark(mark, target);

    return mark;
  };

  const removeInlineMark = (target: HTMLElement, markXPath?: string) => {
    const xPath = markXPath || target.getAttribute(INLINE_SELECTED_MARK_ID);
    const mark = markListRef.current?.find((item) => item?.xPath === xPath);
    markListRef.current = markListRef.current.filter((item) => item.xPath !== xPath);

    removeHighlight(xPath);
    targetList.current = targetList.current.filter((item) => item.getAttribute(INLINE_SELECTED_MARK_ID) !== xPath);

    return mark;
  };

  const removeBlockMark = (target: HTMLElement, markXPath?: string) => {
    const xPath = markXPath || target.getAttribute(BLOCK_SELECTED_MARK_ID);

    const mark = markListRef.current?.find((item) => item?.xPath === xPath);
    markListRef.current = markListRef.current.filter((item) => item.xPath !== xPath);

    (target as Element)?.removeAttribute(BLOCK_SELECTED_MARK_ID);
    targetList.current = targetList.current.filter((item) => item.getAttribute(BLOCK_SELECTED_MARK_ID) !== xPath);

    return mark;
  };

  const syncMarkEvent = (event: Partial<SyncMarkEvent>) => {
    const { type, mark } = event.body;
    // 发送给 refly-main-app
    const msg: BackgroundMessage<{ type: SyncMarkEventType; mark: Mark }> = {
      source: getRuntime(),
      name: 'syncMarkEvent',
      body: {
        type,
        mark: { type: mark?.type, data: mark?.data, xPath: mark?.xPath, scope: selectorScopeRef.current },
      },
    };
    console.log('contentSelectorClickHandler', safeStringifyJSON(msg));
    sendMessage(msg);
  };

  const resetMarkStyle = () => {
    // mark style
    const mark = markRef.current;

    // TODO: 后续改成 react 组件渲染，带来更多自由度，目前现跑通 PoC
    mark.style.top = '0px';
    mark.style.left = '0px';
    mark.style.width = '0px';
    mark.style.height = '0px';
    mark.style.width = '0px';
    mark.style.height = '0px';
  };

  const resetStyle = () => {
    resetMarkStyle();
    // selected list style
    targetList.current.forEach((item) => {
      if (item.getAttribute(BLOCK_SELECTED_MARK_ID)) {
        removeBlockMark(item as HTMLElement);
      } else if (item.getAttribute(INLINE_SELECTED_MARK_ID)) {
        removeInlineMark(item as HTMLElement);
      }
    });
    targetList.current = [];
    markListRef.current = [];
  };

  const isMouseOutsideContainer = (ev: MouseEvent) => {
    const containerElem = selector ? document.querySelector(`.${selector}`) : document.body;
    const containerRect = containerElem.getBoundingClientRect();
    const x = ev.clientX;
    const y = ev.clientY;

    return false;

    if (x < containerRect.left || x > containerRect.right || y < containerRect.top || y > containerRect.bottom) {
      return true;
    } else {
      return false;
    }
  };

  const onMouseMove = (ev: MouseEvent) => {
    ev.stopImmediatePropagation();

    console.log('isMouseOutsideContainer', isMouseOutsideContainer(ev), selector);

    if (isMouseOutsideContainer(ev)) {
      return;
    }

    console.log('contentActionHandler', ev, statusRef, markRef, showContentSelectorRef);
    if (
      statusRef.current &&
      markRef.current &&
      showContentSelectorRef.current &&
      selectorScopeRef.current === 'block'
    ) {
      const { target } = ev;
      const rect = (target as Element)?.getBoundingClientRect();
      const containerElem = selector ? document.querySelector(`.${selector}`) : document.body;
      const containerRect = containerElem.getBoundingClientRect();
      const mark = markRef.current;

      const width = rect.width || 0;
      const height = rect.height || 0;
      const top = rect.top || 0;
      const left = rect.left || 0;
      // console.log('rect', , rect.height, rect.top, rect.left);
      // container 的 top 和 left 是相对于 document 的
      const containerTop = containerRect.top || 0;
      const containerLeft = containerRect.left || 0;

      // console.log('top', window.scrollY + rect.top);
      mark.style.top = window.scrollY + top - containerTop + 'px';
      mark.style.left = window.scrollX + left - containerLeft + 'px';
      mark.style.width = width + 'px';
      mark.style.height = height + 'px';
      mark.style.background = `#ffd40024 !important`;
      mark.style.zIndex = '99999999';
    }
  };

  const onContentClick = (ev: MouseEvent) => {
    ev.stopImmediatePropagation();
    ev.preventDefault();
    ev.stopPropagation();
    let markEvent: { type: 'remove' | 'add'; mark: Mark };

    if (isMouseOutsideContainer(ev)) {
      return;
    }

    if (statusRef.current && markRef.current && showContentSelectorRef.current) {
      const { target } = ev;

      console.log('onContentClick');

      if ((target as Element)?.getAttribute(BLOCK_SELECTED_MARK_ID)) {
        const mark = removeBlockMark(target as HTMLElement);
        markEvent = { type: 'remove', mark };
      } else if ((target as Element)?.getAttribute(INLINE_SELECTED_MARK_ID)) {
        const mark = removeInlineMark(target as HTMLElement);
        markEvent = { type: 'remove', mark };
      } else {
        const mark = addBlockMark(target as HTMLElement);
        markEvent = { type: 'add', mark };
      }

      // 发送给 refly-main-app
      const msg: Partial<SyncMarkEvent> = {
        body: markEvent,
      };
      syncMarkEvent(msg);
    }
  };

  const onMouseDownUpEvent = (ev: MouseEvent) => {
    ev.stopImmediatePropagation();
    ev.preventDefault();
    ev.stopPropagation();

    if (isMouseOutsideContainer(ev)) {
      return;
    }

    const selection = window.getSelection();
    const text = selection?.toString();

    console.log('onMouseDownUpEvent');

    let markEvent: { type: 'remove' | 'add'; mark: Mark };

    if (statusRef.current && markRef.current && showContentSelectorRef.current) {
      if (text && text?.trim()?.length > 0) {
        const mark = addInlineMark();
        markEvent = { type: 'add', mark };

        const msg: Partial<SyncMarkEvent> = {
          body: markEvent,
        };
        syncMarkEvent(msg);
      }
    }
  };

  const initBlockDomEventListener = () => {
    const containerElem = selector ? document.querySelector(`.${selector}`) : document.body;

    containerElem.addEventListener('mousemove', onMouseMove);
    containerElem.addEventListener('click', onContentClick, {
      capture: true,
    });
  };

  const initInlineDomEventListener = () => {
    const containerElem = selector ? document.querySelector(`.${selector}`) : document.body;

    // containerElem.addEventListener('mousedown', onMouseDownUpEvent);
    containerElem.addEventListener('mouseup', onMouseDownUpEvent);
  };

  const initDomEventListener = () => {
    if (selectorScopeRef.current === 'block') {
      initBlockDomEventListener();
    } else {
      initInlineDomEventListener();
    }
  };

  const removeDomEventListener = () => {
    const containerElem = selector ? document.querySelector(`.${selector}`) : document.body;

    containerElem.removeEventListener('mousemove', onMouseMove);
    containerElem.removeEventListener('click', onContentClick, { capture: true });
    containerElem.removeEventListener('mouseup', onMouseDownUpEvent);
  };

  const onStatusHandler = (event: MessageEvent<any>) => {
    const data = event as any as BackgroundMessage;
    console.log('contentSelectorStatusHandler data', event, getRuntime());
    if ((data as SyncStatusEvent)?.name === 'syncStatusEvent') {
      const { type, scope } = (data as SyncStatusEvent)?.body;

      if (type === 'start') {
        selectorScopeRef.current = scope; // 每次开启都动态的处理 scope
        initDomEventListener();
        showContentSelectorRef.current = true;
      } else if (type === 'update') {
        if (!showContentSelectorRef.current) {
          return;
        }

        if (selectorScopeRef.current !== scope) {
          removeDomEventListener();
        }

        if (scope === 'inline') {
          resetMarkStyle(); // 自由选择时不需要 mark style
        }

        selectorScopeRef.current = scope; // 每次开启都动态的处理 scope
        initDomEventListener();
      } else if (type === 'reset') {
        resetStyle();
        removeDomEventListener();
        showContentSelectorRef.current = false;
      } else if (type === 'stop') {
        resetMarkStyle();
        removeDomEventListener();
        showContentSelectorRef.current = false;
      }
    }

    if ((data as SyncMarkEvent)?.name === 'syncMarkEventBack') {
      const { mark, type } = (data as SyncMarkEvent)?.body;

      if (type === 'remove') {
        const xPath = mark?.xPath || '';
        const target = markListRef.current.find((item) => item.xPath === xPath)?.target;

        if (mark?.scope === 'block') {
          removeBlockMark(target as HTMLElement, xPath);
        } else {
          removeInlineMark(target as HTMLElement, xPath);
        }
      }
    }
  };

  const initMessageListener = () => {
    onMessage(onStatusHandler, getRuntime()).then((clearEvent) => {
      messageListenerEventRef.current = clearEvent;
    });

    return () => {
      messageListenerEventRef.current?.();
      removeDomEventListener();
    };
  };

  const initContentSelectorElem = () => {
    // 处理多处引用问题

    return (
      <div className="refly-content-selector-container">
        <div
          ref={markRef}
          style={{
            backgroundColor: '#ffd40024 !important',
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            width: 0,
            height: 0,
            pointerEvents: 'none',
          }}
          className={classNames('refly-content-selector-mark', 'refly-content-selector-mark--active')}
        ></div>
      </div>
    );
  };

  return {
    initContentSelectorElem,
    initMessageListener,
  };
};
