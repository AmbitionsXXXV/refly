import { useBuildThreadAndRun } from '@refly-packages/ai-workspace-common/hooks/use-build-thread-and-run';
import { Button, Tag, Dropdown, Menu, Tooltip, Switch } from '@arco-design/web-react';
import { IconCloseCircle, IconFontColors, IconList, IconMore } from '@arco-design/web-react/icon';
import { useResizeBox } from '@refly-packages/ai-workspace-common/hooks/use-resize-box';
import { getPopupContainer } from '@refly-packages/ai-workspace-common/utils/ui';
import { useTranslation } from 'react-i18next';
import { LOCALE } from '@refly/common-types';
import { languageNameToLocale } from '@refly/common-types';
import { writingSkills } from '@refly/utils/ai-writing';
import { BaseContextCard } from '@refly-packages/ai-workspace-common/components/knowledge-base/copilot/context-state-display/context-card/base-context-card';
import { useGetCurrentEnvContext } from '@refly-packages/ai-workspace-common/components/knowledge-base/copilot/context-panel/hooks/use-get-current-env-context';

// resize hook
const SubMenu = Menu.SubMenu;
const MenuItem = Menu.Item;

export const NoteContextCard = () => {
  const { runSkill } = useBuildThreadAndRun();
  const { hasContent } = useGetCurrentEnvContext();
  const disabled = !hasContent;

  const { t, i18n } = useTranslation();
  const uiLocale = (i18n?.languages?.[0] as LOCALE) || LOCALE.EN;
  const localeList = languageNameToLocale?.[uiLocale];

  console.log('NoteSelectedContextPanel', uiLocale, localeList);

  const [containCnt] = useResizeBox({
    getGroupSelector: () => {
      const container = getPopupContainer();
      const elem = container?.querySelector('.context-state-action-list');

      return elem as HTMLElement;
    },
    getResizeSelector: () => {
      const container = getPopupContainer();
      const elems = container?.querySelectorAll('.context-state-action-item') as NodeListOf<HTMLElement>;

      return elems;
    },
    initialContainCnt: writingSkills.length,
    paddingSize: 0,
    itemSize: 60,
    placeholderWidth: 120,
  });

  console.log('containCnt', containCnt);

  const dropList = (
    <Menu>
      {writingSkills.slice(containCnt).map((skill, index) => {
        if (skill?.itemList && skill?.itemList?.length > 0) {
          return (
            <SubMenu key={`${skill.key}`} title={skill?.title}>
              {skill?.itemList?.map((subSkill, subIndex) => (
                <MenuItem
                  key={`${skill.key}_${subIndex}`}
                  onClick={() => {
                    if (skill?.key === 'translate') {
                      runSkill(skill?.prompt?.replace(`{${skill?.variable || ''}}`, localeList?.[subSkill]));
                    } else {
                      runSkill(skill?.prompt?.replace(`{${skill?.variable || ''}}`, subSkill));
                    }
                  }}
                >
                  {subSkill}
                </MenuItem>
              ))}
            </SubMenu>
          );
        } else {
          return (
            <MenuItem
              key={`${skill.key}`}
              onClick={() => {
                runSkill(skill?.prompt);
              }}
            >
              {skill.title}
            </MenuItem>
          );
        }
      })}
    </Menu>
  );

  const skillLen = writingSkills.length;
  const skillContent = (
    <div className="context-state-action-list">
      {writingSkills.slice(0, containCnt).map((skill, index) => (
        <Button
          type="outline"
          size="mini"
          className="context-state-action-item"
          key={index}
          disabled={disabled}
          style={{ borderRadius: 8 }}
          onClick={() => {
            runSkill(skill?.prompt);
          }}
        >
          {skill.title}
        </Button>
      ))}
      {containCnt >= skillLen || skillLen === 0 ? null : (
        <Dropdown droplist={dropList}>
          <Button
            type="outline"
            size="mini"
            className="context-state-action-item"
            icon={<IconMore />}
            style={{ borderRadius: 8, paddingLeft: 8 }}
          >
            更多
          </Button>
        </Dropdown>
      )}
    </div>
  );
  return (
    <div className="note-selected-context-panel">
      <BaseContextCard title="当前笔记快捷操作" skillContent={skillContent} />
    </div>
  );
};
