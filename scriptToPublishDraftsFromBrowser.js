// Original from: https://github.com/Niedzwiedzw/youtube-publish-drafts
// Modified by me

(() => {
  const VISIBILITY = 'Private' // 'Public' / 'Private' / 'Unlisted'

  const TIMEOUT_STEP_MS = 20
  const DEFAULT_ELEMENT_TIMEOUT_MS = 10000

  const sleep = (ms) => new Promise((resolve, _reject) => setTimeout(resolve, ms))

  async function waitForElement (selector, baseEl, timeoutMs) {
    if (timeoutMs === undefined) {
      timeoutMs = DEFAULT_ELEMENT_TIMEOUT_MS
    }
    if (baseEl === undefined) {
      baseEl = document
    }
    let timeout = timeoutMs
    while (timeout > 0) {
      const element = baseEl.querySelector(selector)
      if (element !== null) {
        return element
      }
      await sleep(TIMEOUT_STEP_MS)
      timeout -= TIMEOUT_STEP_MS
    }
    return null
  }

  function click (element) {
    const event = document.createEvent('MouseEvents')
    event.initMouseEvent('mousedown', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null)
    element.dispatchEvent(event)
    element.click()
  }

  // ----------------------------------
  // PUBLISH STUFF
  // ----------------------------------
  const VISIBILITY_PUBLISH_ORDER = {
    Private: 0,
    Unlisted: 1,
    Public: 2
  }

  // SELECTORS
  const VIDEO_ROW_SELECTOR = 'ytcp-video-row'
  const DRAFT_MODAL_SELECTOR = '.style-scope.ytcp-uploads-dialog'
  const DRAFT_BUTTON_SELECTOR = '.edit-draft-button'
  const RADIO_BUTTON_SELECTOR = 'tp-yt-paper-radio-button'
  const VISIBILITY_STEPPER_SELECTOR = '#step-badge-3'
  const VISIBILITY_PAPER_BUTTONS_SELECTOR = 'tp-yt-paper-radio-group'
  const SAVE_BUTTON_SELECTOR = '#done-button'

  class VisibilityModal {
    constructor (raw) {
      this.raw = raw
    }

    async radioButtonGroup () {
      return await waitForElement(VISIBILITY_PAPER_BUTTONS_SELECTOR, this.raw)
    }

    async visibilityRadioButton () {
      const group = await this.radioButtonGroup()
      const value = VISIBILITY_PUBLISH_ORDER[VISIBILITY]
      return [...group.querySelectorAll(RADIO_BUTTON_SELECTOR)][value]
    }

    async setVisibility () {
      click(await this.visibilityRadioButton())
      await sleep(50)
    }

    async saveButton () {
      return await waitForElement(SAVE_BUTTON_SELECTOR, this.raw)
    }

    async save () {
      click(await this.saveButton())
    }
  }

  class DraftModal {
    constructor (raw) {
      this.raw = raw
    }

    async visibilityStepper () {
      return await waitForElement(VISIBILITY_STEPPER_SELECTOR, this.raw)
    }

    async goToVisibility () {
      await sleep(50)
      click(await this.visibilityStepper())
      const visibility = new VisibilityModal(this.raw)
      await sleep(50)
      await waitForElement(VISIBILITY_PAPER_BUTTONS_SELECTOR, visibility.raw)
      return visibility
    }
  }

  class VideoRow {
    constructor (raw) {
      this.raw = raw
    }

    get editDraftButton () {
      return waitForElement(DRAFT_BUTTON_SELECTOR, this.raw, 20)
    }

    async openDraft () {
      click(await this.editDraftButton)
      return new DraftModal(await waitForElement(DRAFT_MODAL_SELECTOR))
    }
  }

  function allVideos () {
    return [...document.querySelectorAll(VIDEO_ROW_SELECTOR)].map((el) => new VideoRow(el))
  }

  async function editableVideos () {
    let editable = []
    for (const video of allVideos()) {
      if ((await video.editDraftButton) !== null) {
        editable = [...editable, video]
      }
    }
    return editable
  }

  async function publishDrafts () {
    const videos = await editableVideos()
    console.log(`Found ${videos.length} videos to publish`)
    await sleep(500)
    for (const video of videos) {
      const draft = await video.openDraft()
      await sleep(500)
      const visibility = await draft.goToVisibility()
      await sleep(500)
      await visibility.setVisibility()
      await sleep(500)
      await visibility.save()
      await sleep(3000)
    }
  }

  publishDrafts()
})()
