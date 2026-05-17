import { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { confirmDialog, createStyle, toast } from '@/utils/tools'
import { readMusicDownloadDirectory, removeMusicDownloadTarget } from '@/utils/fs'
import { useTheme } from '@/store/theme/hook'
import { Icon } from '@/components/common/Icon'
import { useNavActiveId } from '@/store/common/hook'
import { BorderWidths } from '@/theme'
import { sizeFormate } from '@/utils'
import { getDownloadTasks, removeDownloadTask } from '@/core/music/downloader'
import { handleFileMusicAction } from '@/core/init/deeplink/fileAction'

const ProgressBar = ({ progress }) => {
  const theme = useTheme()
  return (
    <View style={[styles.progressTrack, { backgroundColor: theme['c-primary-light-800-alpha-500'] }]}>
      <View style={[styles.progressBar, { width: `${Math.max(0, Math.min(progress, 1)) * 100}%`, backgroundColor: theme['c-primary'] }]} />
    </View>
  )
}

const ActionButton = ({ label, onPress, danger = false }) => {
  const theme = useTheme()
  return (
    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: danger ? theme['c-primary-background-hover'] : theme['c-button-background'] }]} onPress={onPress} activeOpacity={0.75}>
      <Text size={11} color={danger ? theme['c-font'] : theme['c-button-font']}>{label}</Text>
    </TouchableOpacity>
  )
}

const DownloadRow = ({ item, onPlay, onRemoveRecord, onRemoveFile }) => {
  const theme = useTheme()
  const sizeText = useMemo(() => {
    if (item.total > 0) return `${sizeFormate(item.downloaded || 0)} / ${sizeFormate(item.total)}`
    if (item.size != null) return sizeFormate(item.size || 0)
    return ''
  }, [item.downloaded, item.size, item.total])
  const isRunning = item.status === 'run' || item.status === 'waiting'
  const isCompleted = item.status === 'completed'

  return (
    <View style={[
      styles.row,
      {
        borderColor: theme['c-border-background'],
        backgroundColor: isCompleted ? theme['c-primary-light-800-alpha-500'] : 'rgba(0,0,0,0.03)',
      },
    ]}>
      <Icon name="music" size={16} color={isCompleted ? theme['c-primary-font-active'] : theme['c-primary-font']} />
      <View style={styles.rowCenter}>
        <Text numberOfLines={1}>{item.name}</Text>
        <Text size={11} color={theme['c-font-label']} numberOfLines={1}>
          {[item.quality, item.statusText || item.status, sizeText].filter(Boolean).join(' · ')}
        </Text>
        {isRunning ? <ProgressBar progress={item.progress || 0} /> : null}
      </View>
      <View style={styles.rowActions}>
        {isCompleted ? <ActionButton label="播放" onPress={() => { void onPlay(item) }} /> : null}
        {item.taskId ? <ActionButton label="删记录" onPress={() => { void onRemoveRecord(item) }} danger={!isCompleted} /> : null}
        {item.path ? <ActionButton label="删文件" onPress={() => { void onRemoveFile(item) }} danger /> : null}
      </View>
    </View>
  )
}

export default () => {
  const t = (key, options) => global.i18n.t(key, options)
  const theme = useTheme()
  const navActiveId = useNavActiveId()
  const [isLoading, setLoading] = useState(false)
  const [files, setFiles] = useState([])
  const [tasks, setTasks] = useState([])

  const refresh = useCallback(async() => {
    setLoading(true)
    try {
      const taskList = getDownloadTasks()
      const fileList = await readMusicDownloadDirectory()
      setTasks(taskList)
      setFiles(fileList.filter(item => item.isFile))
    } catch {
      setTasks(getDownloadTasks())
      setFiles([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (navActiveId == 'nav_download') {
      refresh().catch(() => {})
    }
  }, [navActiveId, refresh])

  useEffect(() => {
    const handleDownloadListUpdate = () => {
      if (navActiveId == 'nav_download') {
        refresh().catch(() => {})
      }
    }
    global.app_event.on('downloadListUpdate', handleDownloadListUpdate)
    return () => {
      global.app_event.off('downloadListUpdate', handleDownloadListUpdate)
    }
  }, [navActiveId, refresh])

  const mergedList = useMemo(() => {
    const taskItems = tasks.map(task => ({
      key: `task:${task.id}`,
      taskId: task.id,
      name: task.musicInfo.name,
      path: task.filePath,
      status: task.status,
      statusText: task.errorMessage || task.statusText,
      progress: task.progress,
      downloaded: task.downloaded,
      total: task.total,
      quality: task.quality,
      size: task.total || null,
    }))
    const taskPaths = new Set(taskItems.map(item => item.path).filter(Boolean))
    const fileItems = files
      .filter(item => !taskPaths.has(item.path))
      .map(item => ({
        key: `file:${item.path}`,
        taskId: null,
        name: item.name,
        path: item.path,
        status: 'completed',
        statusText: '已下载',
        progress: 1,
        downloaded: item.size,
        total: item.size,
        quality: '',
        size: item.size,
      }))
    return [...taskItems, ...fileItems]
  }, [files, tasks])

  const handleRefreshPress = () => {
    refresh()
      .then(() => {
        toast(t('download_refreshed'))
      })
      .catch(() => {})
  }

  const handlePlay = async(item) => {
    if (!item.path) return
    await handleFileMusicAction({ path: item.path, name: item.name })
  }

  const handleRemoveRecord = async(item) => {
    if (!item.taskId) return
    if (!await confirmDialog({
      title: '删除下载记录',
      message: `确定删除 ${item.name} 的下载记录吗？`,
    })) return
    await removeDownloadTask(item.taskId, false)
    await refresh()
  }

  const handleRemoveFile = async(item) => {
    if (!item.path) return
    if (!await confirmDialog({
      title: '删除下载文件',
      message: `确定删除 ${item.name} 吗？`,
    })) return
    if (item.taskId) {
      await removeDownloadTask(item.taskId, true)
    } else {
      await removeMusicDownloadTarget(item.path)
      global.app_event.downloadListUpdate()
    }
    await refresh()
  }

  return (
    <View style={styles.container}>
      <View style={[
        styles.header,
        { borderBottomColor: theme['c-border-background'] },
      ]}>
        <Text style={styles.title} size={17}>{t('nav_download')}</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={handleRefreshPress} activeOpacity={0.75}>
          <Text size={12}>{t('download_refresh')}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {
          isLoading
            ? <Text style={styles.tip} color={theme['c-font-label']}>{t('download_loading')}</Text>
            : mergedList.length
              ? mergedList.map(item => (
                <DownloadRow
                  key={item.key}
                  item={item}
                  onPlay={handlePlay}
                  onRemoveRecord={handleRemoveRecord}
                  onRemoveFile={handleRemoveFile}
                />
              ))
              : <Text style={styles.tip} color={theme['c-font-label']}>{t('download_empty')}</Text>
        }
      </ScrollView>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: BorderWidths.normal,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 14,
  },
  title: {
    fontWeight: '700',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  list: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  row: {
    borderWidth: BorderWidths.normal,
    borderRadius: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowCenter: {
    flex: 1,
    paddingLeft: 8,
  },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    marginLeft: 8,
  },
  actionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    marginLeft: 6,
    marginTop: 4,
  },
  progressTrack: {
    height: 4,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  tip: {
    textAlign: 'center',
    paddingVertical: 24,
  },
})
