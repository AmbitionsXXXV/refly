import { useCallback } from 'react';
import {
  ActionStep,
  ActionStepMeta,
  Artifact,
  Entity,
  InvokeSkillRequest,
  SkillEvent,
} from '@refly/openapi-schema';
import { useUserStore } from '@refly-packages/ai-workspace-common/stores/user';
import { ssePost } from '@refly-packages/ai-workspace-common/utils/sse-post';
import { LOCALE } from '@refly/common-types';
import { getRuntime } from '@refly/utils/env';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { showErrorNotification } from '@refly-packages/ai-workspace-common/utils/notification';
import { useActionResultStore } from '@refly-packages/ai-workspace-common/stores/action-result';
import { aggregateTokenUsage, genActionResultID } from '@refly-packages/utils/index';
import {
  CanvasNodeData,
  SkillNodeMeta,
} from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { convertContextItemsToInvokeParams } from '@refly-packages/ai-workspace-common/utils/map-context-items';
import { useFindThreadHistory } from '@refly-packages/ai-workspace-common/hooks/canvas/use-find-thread-history';
import { useActionPolling } from './use-action-polling';
import { useFindMemo } from '@refly-packages/ai-workspace-common/hooks/canvas/use-find-memo';
import { useUpdateActionResult } from './use-update-action-result';
import { useSubscriptionUsage } from '../use-subscription-usage';
import { useCanvasStore } from '@refly-packages/ai-workspace-common/stores/canvas';
import { getArtifactContentAndAttributes } from '@refly-packages/ai-workspace-common/modules/artifacts/utils';
import { useFindCodeArtifact } from '@refly-packages/ai-workspace-common/hooks/canvas/use-find-code-artifact';

export const useInvokeAction = () => {
  const { addNode } = useAddNode();
  const setNodeDataByEntity = useSetNodeDataByEntity();

  const globalAbortControllerRef = { current: null as AbortController | null };
  const globalIsAbortedRef = { current: false as boolean };

  const { refetchUsage } = useSubscriptionUsage();

  const { createTimeoutHandler } = useActionPolling();
  const onUpdateResult = useUpdateActionResult();

  const onSkillStart = (_skillEvent: SkillEvent) => {};

  const onSkillLog = (skillEvent: SkillEvent) => {
    const { resultId, step, log } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result || !step) {
      return;
    }

    const updatedStep: ActionStep = findOrCreateStep(result.steps ?? [], step);
    updatedStep.logs = [...(updatedStep.logs || []), log];

    const updatedResult = {
      ...result,
      status: 'executing' as const,
      steps: getUpdatedSteps(result.steps ?? [], updatedStep),
    };
    onUpdateResult(skillEvent.resultId, updatedResult, skillEvent);
  };

  const onSkillTokenUsage = (skillEvent: SkillEvent) => {
    const { resultId, step, tokenUsage } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result || !step) {
      return;
    }

    const updatedStep: ActionStep = findOrCreateStep(result.steps ?? [], step);
    updatedStep.tokenUsage = aggregateTokenUsage([...(updatedStep.tokenUsage ?? []), tokenUsage]);

    onUpdateResult(
      resultId,
      {
        ...result,
        steps: getUpdatedSteps(result.steps ?? [], updatedStep),
      },
      skillEvent,
    );
  };

  const findOrCreateStep = (steps: ActionStep[], stepMeta: ActionStepMeta) => {
    const existingStep = steps?.find((s) => s.name === stepMeta?.name);
    return existingStep
      ? { ...existingStep }
      : {
          ...stepMeta,
          content: '',
          reasoningContent: '',
          artifacts: [],
          structuredData: {},
        };
  };

  const getUpdatedSteps = (steps: ActionStep[], updatedStep: ActionStep) => {
    if (!steps?.find((step) => step.name === updatedStep.name)) {
      return [...steps, updatedStep];
    }
    return steps.map((step) => (step.name === updatedStep.name ? updatedStep : step));
  };

  const onSkillStreamArtifact = (resultId: string, artifact: Artifact, content: string) => {
    // Handle code artifact content if this is a code artifact stream
    if (artifact && artifact.type === 'codeArtifact') {
      // Get the code content and attributes as an object
      const {
        content: codeContent,
        title,
        language,
        type,
      } = getArtifactContentAndAttributes(content);

      // Check if the node exists and create it if not
      const canvasState = useCanvasStore.getState();
      const currentCanvasId = canvasState.currentCanvasId;

      // Skip if no active canvas
      if (!currentCanvasId) return;

      const canvasData = canvasState.data[currentCanvasId];
      const existingNode = canvasData?.nodes?.find(
        (node) => node.data?.entityId === artifact.entityId && node.type === artifact.type,
      );

      // If node doesn't exist, create it
      if (!existingNode) {
        addNode(
          {
            type: artifact.type,
            data: {
              // Use extracted title if available, fallback to artifact.title
              title: title || artifact.title,
              entityId: artifact.entityId,
              contentPreview: codeContent, // Set content preview for code artifact
              metadata: {
                status: 'generating',
                language: language || 'typescript', // Use extracted language or default
                type: type || '', // Use extracted type if available
              },
            },
          },
          [
            {
              type: 'skillResponse',
              entityId: resultId,
            },
          ],
        );
      } else {
        // Update existing node with new content and attributes
        setNodeDataByEntity(
          {
            type: artifact.type,
            entityId: artifact.entityId,
          },
          {
            // Update title if available from extracted attributes
            ...(title && { title }),
            contentPreview: codeContent, // Update content preview
            metadata: {
              status: 'generating',
              // Update language and type if available from extracted attributes
              ...(language && { language }),
              ...(type && { type }),
            },
          },
        );
      }
    }
  };

  const onSkillStream = (skillEvent: SkillEvent) => {
    const { resultId, content, reasoningContent = '', step, artifact } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result || !step) {
      return;
    }

    // Regular stream content handling (non-code artifact)
    const updatedStep: ActionStep = findOrCreateStep(result.steps ?? [], step);
    updatedStep.content += content;

    if (!updatedStep.reasoningContent) {
      updatedStep.reasoningContent = reasoningContent;
    } else {
      updatedStep.reasoningContent += reasoningContent;
    }

    // Handle code artifact content if this is a code artifact stream
    onSkillStreamArtifact(resultId, artifact, updatedStep.content);

    onUpdateResult(
      resultId,
      {
        ...result,
        status: 'executing' as const,
        steps: getUpdatedSteps(result.steps ?? [], updatedStep),
      },
      skillEvent,
    );
  };

  const onSkillStructedData = (skillEvent: SkillEvent) => {
    const { step, resultId, structuredData = {} } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result || !structuredData || !step) {
      return;
    }

    const updatedStep: ActionStep = findOrCreateStep(result.steps ?? [], step);

    // Handle chunked sources data
    if (structuredData.sources && Array.isArray(structuredData.sources)) {
      const existingData = updatedStep.structuredData || {};
      const existingSources = (existingData.sources || []) as any[];

      // If this is a chunk of sources, merge it with existing sources
      if (structuredData.isPartial !== undefined) {
        updatedStep.structuredData = {
          ...existingData,
          sources: [...existingSources, ...structuredData.sources],
          isPartial: structuredData.isPartial,
          chunkIndex: structuredData.chunkIndex,
          totalChunks: structuredData.totalChunks,
        };
      } else {
        // Handle non-chunked data as before
        updatedStep.structuredData = {
          ...existingData,
          ...structuredData,
        };
      }
    } else {
      // Handle non-sources structured data
      updatedStep.structuredData = {
        ...updatedStep.structuredData,
        ...structuredData,
      };
    }

    const updatedResult = {
      ...result,
      status: 'executing' as const,
      steps: getUpdatedSteps(result.steps ?? [], updatedStep),
    };
    onUpdateResult(skillEvent.resultId, updatedResult, skillEvent);
  };

  const onSkillArtifact = (skillEvent: SkillEvent) => {
    const { resultId, artifact, step } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result || !step) {
      return;
    }

    const updatedStep: ActionStep = findOrCreateStep(result.steps ?? [], step);
    const existingArtifacts = Array.isArray(updatedStep.artifacts)
      ? [...updatedStep.artifacts]
      : [];
    const artifactIndex = existingArtifacts.findIndex(
      (item) => item?.entityId === artifact?.entityId,
    );

    updatedStep.artifacts =
      artifactIndex !== -1
        ? existingArtifacts.map((item, index) => (index === artifactIndex ? artifact : item))
        : [...existingArtifacts, artifact];

    const updatedResult = {
      ...result,
      status: 'executing' as const,
      steps: getUpdatedSteps(result.steps ?? [], updatedStep),
    };

    onUpdateResult(skillEvent.resultId, updatedResult, skillEvent);
  };

  const onSkillCreateNode = (skillEvent: SkillEvent) => {
    const { node, resultId } = skillEvent;
    addNode(
      {
        type: node.type,
        data: {
          ...node.data,
          metadata: {
            status: 'executing',
            ...node.data?.metadata,
          },
        } as CanvasNodeData,
      },
      [
        {
          type: 'skillResponse',
          entityId: resultId,
        },
      ],
    );
  };

  const onSkillEnd = (skillEvent: SkillEvent) => {
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[skillEvent.resultId];

    if (!result) {
      return;
    }

    const updatedResult = {
      ...result,
      status: 'finish' as const,
    };
    onUpdateResult(skillEvent.resultId, updatedResult, skillEvent);

    const artifacts = result.steps?.flatMap((s) => s.artifacts);
    if (artifacts?.length) {
      for (const artifact of artifacts) {
        setNodeDataByEntity(
          {
            type: artifact.type,
            entityId: artifact.entityId,
          },
          {
            metadata: {
              status: 'finish',
            },
          },
        );
      }
    }

    refetchUsage();
  };

  const onSkillError = (skillEvent: SkillEvent) => {
    const runtime = getRuntime();
    const { localSettings } = useUserStore.getState();
    const locale = localSettings?.uiLocale as LOCALE;

    const { error, resultId } = skillEvent;
    showErrorNotification(error, locale);

    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result) {
      return;
    }

    const updatedResult = {
      ...result,
      status: 'failed' as const,
      errors: [error?.errMsg],
    };
    onUpdateResult(skillEvent.resultId, updatedResult, skillEvent);

    if (runtime?.includes('extension')) {
      if (globalIsAbortedRef.current) {
        return;
      }
    } else {
      // if it is aborted, do nothing
      if (globalAbortControllerRef.current?.signal?.aborted) {
        return;
      }
    }

    abortAction(error?.errMsg);
  };

  const abortAction = useCallback(
    (_msg?: string) => {
      try {
        globalAbortControllerRef.current?.abort();
        globalIsAbortedRef.current = true;
      } catch (err) {
        console.log('shutdown error', err);
      }
    },
    [globalAbortControllerRef, globalIsAbortedRef],
  );

  const onCompleted = () => {};
  const onStart = () => {};
  const findThreadHistory = useFindThreadHistory();
  const findMemo = useFindMemo();
  const findCodeArtifact = useFindCodeArtifact();

  const invokeAction = (payload: SkillNodeMeta, target: Entity) => {
    payload.resultId ||= genActionResultID();
    payload.selectedSkill ||= { name: 'commonQnA' };

    const {
      query,
      modelInfo,
      contextItems,
      selectedSkill,
      resultId,
      version = 0,
      tplConfig = {},
    } = payload;
    const { context, resultHistory, images } = convertContextItemsToInvokeParams(
      contextItems,
      (item) =>
        findThreadHistory({ resultId: item.entityId }).map((node) => ({
          title: node.data?.title,
          resultId: node.data?.entityId,
        })),
      (item) => {
        if (item.type === 'memo') {
          return findMemo({ resultId: item.entityId }).map((node) => ({
            content: node.data?.contentPreview ?? '',
            title: node.data?.title ?? 'Memo',
          }));
        }
        return [];
      },
      (item) => {
        if (item.type === 'codeArtifact') {
          return findCodeArtifact({ resultId: item.entityId }).map((node) => ({
            content: node.data?.contentPreview ?? '',
            title: node.data?.title ?? 'Code',
          }));
        }
        return [];
      },
    );

    const param: InvokeSkillRequest = {
      resultId,
      input: {
        query,
        images,
      },
      target,
      modelName: modelInfo?.name,
      context,
      resultHistory,
      skillName: selectedSkill?.name,
      tplConfig,
    };

    onUpdateResult(resultId, {
      resultId,
      version,
      type: 'skill',
      actionMeta: selectedSkill,
      modelInfo,
      title: query,
      targetId: target?.entityId,
      targetType: target?.entityType,
      context,
      history: resultHistory,
      tplConfig,
      status: 'waiting',
      steps: [],
      errors: [],
    });

    globalAbortControllerRef.current = new AbortController();

    // Create timeout handler for this action
    const { resetTimeout, cleanup } = createTimeoutHandler(resultId, version);

    // Wrap event handlers to reset timeout
    const wrapEventHandler =
      (handler: (...args: any[]) => void) =>
      (...args: any[]) => {
        resetTimeout();
        handler(...args);
      };

    resetTimeout();

    ssePost({
      controller: globalAbortControllerRef.current,
      payload: param,
      onStart: wrapEventHandler(onStart),
      onSkillStart: wrapEventHandler(onSkillStart),
      onSkillStream: wrapEventHandler(onSkillStream),
      onSkillLog: wrapEventHandler(onSkillLog),
      onSkillArtifact: wrapEventHandler(onSkillArtifact),
      onSkillStructedData: wrapEventHandler(onSkillStructedData),
      onSkillCreateNode: wrapEventHandler(onSkillCreateNode),
      onSkillEnd: wrapEventHandler(onSkillEnd),
      onCompleted: wrapEventHandler(onCompleted),
      onSkillError: wrapEventHandler(onSkillError),
      onSkillTokenUsage: wrapEventHandler(onSkillTokenUsage),
    });

    return cleanup;
  };

  return { invokeAction, abortAction };
};
