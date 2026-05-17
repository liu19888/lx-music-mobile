import { memo } from 'react'

import Section from '../../components/Section'
import SavePath from './SavePath'
import DownloadQuality from './DownloadQuality'

export default memo(() => {
  return (
    <Section title="下载设置">
      <SavePath />
      <DownloadQuality />
    </Section>
  )
})
