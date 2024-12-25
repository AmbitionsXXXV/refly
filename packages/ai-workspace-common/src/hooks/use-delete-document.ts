import { useState } from 'react';
import { message } from 'antd';
import * as Y from 'yjs';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useDebouncedCallback } from 'use-debounce';
import { useDocumentStoreShallow } from '@refly-packages/ai-workspace-common/stores/document';
import { IndexeddbPersistence } from 'y-indexeddb';

export const useDeleteDocument = () => {
  const [isRemoving, setIsRemoving] = useState(false);
  const { t } = useTranslation();

  const { deleteDocumentData } = useDocumentStoreShallow((state) => ({
    deleteDocumentData: state.deleteDocumentData,
  }));

  const deleteDocument = async (docId: string) => {
    if (isRemoving) return;
    let success = false;
    try {
      setIsRemoving(true);
      const { data } = await getClient().deleteDocument({
        body: {
          docId,
        },
      });

      if (data?.success) {
        success = true;
        deleteDocumentData(docId);

        // Clear IndexedDB persistence for the deleted document
        const indexedDbProvider = new IndexeddbPersistence(docId, new Y.Doc());
        await indexedDbProvider.clearData();
        await indexedDbProvider.destroy();
      }
    } finally {
      setIsRemoving(false);
    }
    return success;
  };

  const debouncedDeleteDocument = useDebouncedCallback(
    (documentId: string) => {
      return deleteDocument(documentId);
    },
    300,
    { leading: true },
  );

  return { deleteDocument: debouncedDeleteDocument, isRemoving };
};
