import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { Dropdown, Button, Popconfirm, message, Empty, Divider } from 'antd';
import type { MenuProps, DropdownProps } from 'antd';
import {
  IconMoreHorizontal,
  IconDelete,
  IconResourceFilled,
} from '@refly-packages/ai-workspace-common/components/common/icon';

import { useEffect, useState } from 'react';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { LOCALE } from '@refly/common-types';
import { useTranslation } from 'react-i18next';

import { useFetchDataList } from '@refly-packages/ai-workspace-common/hooks/use-fetch-data-list';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { ScrollLoading } from '@refly-packages/ai-workspace-common/components/workspace/scroll-loading';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { Resource } from '@refly/openapi-schema';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { NODE_COLORS } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/colors';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { LuPlus } from 'react-icons/lu';
import { useDeleteResource } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-resource';

const ActionDropdown = ({ resource, afterDelete }: { resource: Resource; afterDelete: () => void }) => {
  const { t } = useTranslation();
  const [popupVisible, setPopupVisible] = useState(false);
  const { refetchUsage } = useSubscriptionUsage();
  const { addNode } = useAddNode();
  const { setShowLibraryModal } = useSiderStoreShallow((state) => ({
    setShowLibraryModal: state.setShowLibraryModal,
  }));
  const { deleteResource } = useDeleteResource();

  const handleDelete = async () => {
    const success = await deleteResource(resource.resourceId);
    if (success) {
      message.success(t('common.putSuccess'));
      setPopupVisible(false);
      refetchUsage();
      afterDelete?.();
    }
  };

  const handleAddToCanvas = () => {
    addNode({
      type: 'resource',
      data: {
        title: resource.title,
        entityId: resource.resourceId,
        contentPreview: resource.contentPreview,
      },
    });
    setShowLibraryModal(false);
  };

  const items: MenuProps['items'] = [
    {
      label: (
        <div className="flex items-center">
          <LuPlus size={16} className="mr-2" />
          {t('workspace.addToCanvas')}
        </div>
      ),
      key: 'addToCanvas',
      onClick: () => handleAddToCanvas(),
    },
    {
      label: (
        <Popconfirm
          placement="bottomLeft"
          title={t('canvas.nodeActions.resourceDeleteConfirm', {
            title: resource.title || t('common.untitled'),
          })}
          onConfirm={handleDelete}
          onCancel={() => setPopupVisible(false)}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
          overlayStyle={{ maxWidth: '300px' }}
        >
          <div className="flex items-center text-red-600">
            <IconDelete size={16} className="mr-2" />
            {t('workspace.deleteDropdownMenu.delete')}
          </div>
        </Popconfirm>
      ),
      key: 'delete',
    },
  ];

  const handleOpenChange: DropdownProps['onOpenChange'] = (open: boolean, info: any) => {
    if (info.source === 'trigger') {
      setPopupVisible(open);
    }
  };

  return (
    <Dropdown trigger={['click']} open={popupVisible} onOpenChange={handleOpenChange} menu={{ items }}>
      <Button type="text" icon={<IconMoreHorizontal />} />
    </Dropdown>
  );
};

const ResourceCard = ({ item, onDelete }: { item: Resource; onDelete: () => void }) => {
  const { t, i18n } = useTranslation();
  const language = i18n.languages?.[0];

  return (
    <div className="bg-white rounded-lg overflow-hidden border border-solid cursor-pointer border-gray-200 hover:border-green-500 transition-colors duration-200">
      <div className="h-36 px-4 py-3 overflow-hidden">
        <Markdown
          content={item.contentPreview || t('canvas.nodePreview.resource.noContentPreview')}
          className="text-xs opacity-80"
        />
      </div>
      <Divider className="m-0 text-gray-200" />
      <div className="px-3 pt-2 pb-1 flex justify-between items-center bg-gray-50">
        <div className="flex items-center gap-3 mb-2">
          <IconResourceFilled color={NODE_COLORS['resource']} size={24} />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium max-w-48 truncate">{item.title || t('common.untitled')}</h3>
            <p className="text-xs text-gray-500">
              {time(item.updatedAt, language as LOCALE)
                .utc()
                .fromNow()}
            </p>
          </div>
        </div>
        <ActionDropdown resource={item} afterDelete={onDelete} />
      </div>
    </div>
  );
};

export const ResourceList = () => {
  const { t } = useTranslation();
  const { showLibraryModal } = useSiderStoreShallow((state) => ({
    showLibraryModal: state.showLibraryModal,
  }));

  const { dataList, loadMore, reload, hasMore, isRequesting, setDataList } = useFetchDataList({
    fetchData: async (queryPayload) => {
      const res = await getClient().listResources({
        query: queryPayload,
      });
      return res?.data;
    },
    pageSize: 12,
  });

  useEffect(() => {
    if (showLibraryModal) {
      reload();
    }
  }, [showLibraryModal]);

  return (
    <Spin className="w-full h-full" spinning={isRequesting}>
      <div className="w-full h-[calc(50vh-60px)] overflow-y-auto">
        {isRequesting || dataList.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
              {dataList.map((item) => (
                <ResourceCard
                  key={item.resourceId}
                  item={item}
                  onDelete={() => setDataList(dataList.filter((n) => n.resourceId !== item.resourceId))}
                />
              ))}
            </div>
            <ScrollLoading isRequesting={isRequesting} hasMore={hasMore} loadMore={loadMore} />
          </>
        ) : (
          <div className="h-full flex items-center justify-center">
            <Empty description={t('common.empty')} />
          </div>
        )}
      </div>
    </Spin>
  );
};
