import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button, Tooltip, Message } from '@arco-design/web-react';
import { reflyEnv } from '@/utils/env';

import '@/i18n/config';
import Logo from '@/assets/logo.svg';
import './App.scss';
import classNames from 'classnames';
import { IconHighlight, IconSave, IconClose } from '@arco-design/web-react/icon';
import { useSaveCurrentWeblinkAsResource } from '@/hooks/use-save-resource';
import { useToggleCopilot } from '@/modules/toggle-copilot/hooks/use-toggle-copilot';
import { useSaveResourceNotify } from '@refly-packages/ai-workspace-common/hooks/use-save-resouce-notify';
import { useListenToCopilotType } from '@/modules/toggle-copilot/hooks/use-listen-to-copilot-type';
import { useTranslation } from 'react-i18next';
import { useSelectedMark } from '@/components/content-selector/hooks/use-selected-mark';
import {
  onMessage,
  sendMessage,
} from '@refly-packages/ai-workspace-common/utils/extension/messaging';
import { getRuntime } from '@refly/utils/env';
import { useSaveSelectedContent } from '@/hooks/use-save-selected-content';
import { BackgroundMessage, SyncMarkEvent, type MessageName } from '@refly/common-types';
import { getMarkdown } from '@refly/utils/html2md';

const getPopupContainer = () => {
  const elem = document
    .querySelector('refly-float-sphere')
    ?.shadowRoot?.querySelector('.refly-floating-sphere-entry-container');

  return elem as HTMLElement;
};

export const App = () => {
  const [selectedText, setSelectedText] = useState<string>('');
  const { saveResource } = useSaveCurrentWeblinkAsResource();
  const { handleSaveResourceAndNotify } = useSaveResourceNotify();
  const { handleToggleCopilot } = useToggleCopilot();
  const { handleStopContentSelectorListener, handleInitContentSelectorListener } =
    useSelectedMark();
  const { saveSelectedContent } = useSaveSelectedContent();
  const { t, i18n } = useTranslation();
  const [isContentSelectorOpen, setIsContentSelectorOpen] = useState(false);

  console.log('i18n', i18n?.languages);

  // 加载快捷键
  const [shortcut, setShortcut] = useState<string>(
    reflyEnv.getOsType() === 'OSX' ? '⌘ J' : 'Ctrl J',
  );
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ y: 0 });
  const sphereRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ y: 0, offsetY: 0 });
  const [dropdownPosition, setDropdownPosition] = useState<'top' | 'bottom'>('top');
  const [isHovered, setIsHovered] = useState(false);
  const bottomDistanceRef = useRef(0);

  // listen to copilotType
  useListenToCopilotType();

  // Listen to mark sync events
  useEffect(() => {
    onMessage((event: MessageEvent<any>) => {
      const data = event as any as BackgroundMessage;
      if ((data as SyncMarkEvent)?.name === 'syncMarkEvent') {
        const { type, content } = (data as SyncMarkEvent)?.body ?? { type: '', content: '' };
        if (type === 'add' && content) {
          const boundSaveSelectedContent = () => saveSelectedContent(content);
          handleSaveResourceAndNotify(boundSaveSelectedContent);
        }
      }

      // Handle get page content request
      if (data?.name === 'getPageContent') {
        // Get page content using readability
        const content = getMarkdown(document?.body);
        // Send response back with complete page information
        const response = {
          source: getRuntime(),
          name: 'getPageContentResponse' as MessageName,
          body: {
            title: document?.title || '',
            url: window?.location?.href || '',
            content,
          },
        };
        sendMessage(response);
      }
    }, getRuntime());
  }, []);

  const updateSpherePosition = (newY: number) => {
    if (sphereRef.current) {
      const sphereHeight = sphereRef.current.offsetHeight;
      const maxY = window.innerHeight - sphereHeight;
      const clampedY = Math.max(0, Math.min(newY, maxY));
      setPosition({ y: clampedY });
      bottomDistanceRef.current = window.innerHeight - clampedY - sphereHeight;
    }
  };

  const updateDropdownPosition = () => {
    if (sphereRef.current && dropdownRef.current) {
      const sphereRect = sphereRef.current.getBoundingClientRect();
      const dropdownHeight = dropdownRef.current.offsetHeight;
      const topSpace = sphereRect.top;
      const bottomSpace = window.innerHeight - sphereRect.bottom;

      // console.log('topSpace', topSpace);
      // console.log('bottomSpace', bottomSpace);
      // console.log('dropdownHeight', dropdownHeight);

      if (bottomSpace < dropdownHeight + 8) {
        setDropdownPosition('top');
      } else if (topSpace < dropdownHeight + 8) {
        setDropdownPosition('bottom');
      } else {
        setDropdownPosition('top'); // 默认显示在下方
      }
    }
  };

  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartPos.current = {
      y: e.clientY,
      offsetY: position.y,
    };
    e.preventDefault();
  };

  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsDropdownVisible(true);
    updateDropdownPosition();
  }, []);

  const handleMouseLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setIsDropdownVisible(false);
    }, 300);
  }, []);

  const handleToggleContentSelectorPanel = (isContentSelectorOpen: boolean) => {
    if (!isContentSelectorOpen) {
      setIsContentSelectorOpen(true);
      handleInitContentSelectorListener();
      Message.info(t('extension.floatingSphere.enableSelectContentToAskNotify'));
      handleToggleCopilot(true);
    } else {
      handleStopContentSelectorListener();
      setIsContentSelectorOpen(false);
      Message.info(t('extension.floatingSphere.disableSelectContentToAskNotify'));
    }
  };

  const Dropdown = useCallback(() => {
    return (
      <div
        className={`refly-floating-sphere-dropdown ${dropdownPosition}`}
        style={{
          position: 'absolute',
          right: 4,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Dropdown menu content */}
        <div className="refly-floating-sphere-dropdown-connector" />
        <div className="refly-floating-sphere-dropdown-menu" ref={dropdownRef}>
          {/* <Tooltip content="总结此页面" position="left" getPopupContainer={getPopupContainer}>
            <Button
              type="text"
              shape="circle"
              icon={<IconBulb />}
              size="small"
              className="refly-floating-sphere-dropdown-item assist-action-item"
            ></Button>
          </Tooltip> */}
          <Tooltip
            content={t(
              isContentSelectorOpen
                ? 'extension.floatingSphere.closeContentSelector'
                : 'extension.floatingSphere.selectContentToAsk',
            )}
            position="left"
            getPopupContainer={getPopupContainer}
          >
            <Button
              type="text"
              shape="circle"
              icon={<IconHighlight />}
              size="small"
              onClick={() => {
                handleToggleContentSelectorPanel(isContentSelectorOpen);
              }}
              className={`refly-floating-sphere-dropdown-item assist-action-item ${isContentSelectorOpen ? 'active' : ''}`}
            />
          </Tooltip>
          <Tooltip
            content={t('extension.floatingSphere.saveResource')}
            position="left"
            getPopupContainer={getPopupContainer}
          >
            <Button
              type="text"
              shape="circle"
              icon={<IconSave />}
              size="small"
              onClick={() => {
                console.log('saveResource', saveResource);
                handleSaveResourceAndNotify(saveResource);
              }}
              className="refly-floating-sphere-dropdown-item assist-action-item"
            />
          </Tooltip>
        </div>
      </div>
    );
  }, [dropdownPosition, handleMouseEnter, handleMouseLeave, isContentSelectorOpen]);

  useEffect(() => {
    Message.config({
      getContainer: () => getPopupContainer() as HTMLElement,
    });
  }, []);
  useEffect(() => {
    // 设置初始位置
    bottomDistanceRef.current = window.innerHeight * 0.25; // 距离底部 25% 的位置
    const initialY =
      window.innerHeight - bottomDistanceRef.current - (sphereRef.current?.offsetHeight || 0);
    updateSpherePosition(initialY);

    const handleResize = () => {
      const newY =
        window.innerHeight - bottomDistanceRef.current - (sphereRef.current?.offsetHeight || 0);
      updateSpherePosition(newY);
      updateDropdownPosition();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && sphereRef.current) {
        const dy = e.clientY - dragStartPos.current.y;
        const newY = dragStartPos.current.offsetY + dy;
        updateSpherePosition(newY);
        updateDropdownPosition();
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const [isVisible, setIsVisible] = useState(true);

  const handleClose = (e: React.MouseEvent) => {
    Message.info({
      content: t('extension.floatingSphere.toggleCopilotClose'),
      duration: 3000,
    });

    e.stopPropagation();
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="refly-floating-sphere-entry-container">
      <div
        ref={sphereRef}
        className={classNames('refly-floating-sphere-entry', {
          active: !!selectedText || isDragging || isDropdownVisible,
        })}
        style={{
          top: `${position.y}px`,
          right: '0px',
        }}
      >
        <div className={classNames('refly-floating-sphere-entry-wrapper')}>
          <div
            className={classNames('refly-floating-sphere-entry-content', {
              active: !!selectedText || isDragging || isDropdownVisible,
            })}
            onMouseDown={handleDragStart}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={(_) => handleToggleCopilot()}
          >
            <Tooltip
              position="left"
              content={t('extension.floatingSphere.toggleCopilotTooltip')}
              getPopupContainer={getPopupContainer}
            >
              <Button
                type="text"
                shape="circle"
                icon={<IconClose />}
                style={{
                  fontSize: 10,
                  width: 16,
                  height: 16,
                }}
                size="mini"
                className="refly-floating-sphere-close-button"
                onClick={(e) => handleClose(e as any as React.MouseEvent)}
              />
            </Tooltip>
            <img
              src={Logo}
              alt={t('extension.floatingSphere.toggleCopilot')}
              style={{ width: 25, height: 25 }}
            />
            <span className="refly-floating-sphere-entry-shortcut">{shortcut}</span>
          </div>

          {isDropdownVisible && <Dropdown />}
        </div>
      </div>
    </div>
  );
};
