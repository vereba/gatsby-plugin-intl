const webpack = require("webpack")
const fs = require(`fs`)
const flatten = require("flat")

// remove endings "/" and ".html" from fileNames
const removeFileEndings = fileName =>
  fileName.replace(/\/+$/, "").replace(".html", "")

exports.onCreateWebpackConfig = ({ actions, plugins }, pluginOptions) => {
  const { redirectComponent = null, languages, defaultLanguage } = pluginOptions
  if (!languages.includes(defaultLanguage)) {
    languages.push(defaultLanguage)
  }

  // ['en', 'de', 'en-US'] -> /en|de|en/
  const regex = new RegExp(languages.map(l => l.split("-")[0]).join("|"))
  actions.setWebpackConfig({
    plugins: [
      plugins.define({
        GATSBY_INTL_REDIRECT_COMPONENT_PATH: JSON.stringify(redirectComponent),
      }),
      new webpack.ContextReplacementPlugin(
        /@formatjs[/\\]intl-relativetimeformat[/\\]dist[/\\]locale-data$/,
        regex
      ),
      new webpack.ContextReplacementPlugin(
        /@formatjs[/\\]intl-pluralrules[/\\]dist[/\\]locale-data$/,
        regex
      ),
    ],
  })
}
exports.onCreatePage = async ({ page, actions }, pluginOptions) => {
  //Exit if the page has already been processed.
  if (typeof page.context.intl === "object") {
    return
  }
  const { createPage, deletePage } = actions
  const {
    path = ".",
    languages = ["en"],
    defaultLanguage = "en",
    redirect = false,
    sharedMessages = "common.json",
    messagesMustBeSplit = false,
  } = pluginOptions

  const getMessages = (path, language, file) => {
    const languagePath = `${path}/${language}`
    const filePath = `${languagePath}${removeFileEndings(file)}.json`
    const sharedMessagePath = `${languagePath}/${sharedMessages}`

    let messages
    try {
      messages = require(filePath)
    } catch (error) {
      if (messagesMustBeSplit) {
        if (typeof messages === "undefined") {
          // && messagesMustBeSplit){
          console.error(
            `[gatsby-plugin-intl] couldn't read file "${filePath}", messages is undefined.`
          )
        }
        if (error.code === "MODULE_NOT_FOUND") {
          process.env.NODE_ENV !== "test" &&
            console.error(
              `[gatsby-plugin-intl] couldn't find file "${filePath}"`
            )
        }
      }
    }

    if (fs.existsSync(`${sharedMessagePath}`)) {
      messages = messages
        ? Object.assign(messages, require(`${sharedMessagePath}`))
        : require(`${sharedMessagePath}`)
    }
    if (Object.keys(messages).length === 0 && messages.constructor === Object) {
      console.error(
        `No translations for language '${language}': Could neither find common file (${sharedMessagePath}) nor file "${filePath}"`
      )
      return {}
    } else {
      return flatten(messages)
    }
  }

  const generatePage = (routed, language) => {
    const fileName = page.path !== "/" ? page.path : "/index"
    const messages = getMessages(path, language, fileName)

    const newPath = routed ? `/${language}${page.path}` : page.path
    return {
      ...page,
      path: newPath,
      context: {
        ...page.context,
        language,
        intl: {
          language,
          languages,
          messages,
          routed,
          originalPath: page.path,
          redirect,
          defaultLanguage,
        },
      },
    }
  }

  const newPage = generatePage(false, defaultLanguage)
  deletePage(page)
  createPage(newPage)

  languages.forEach(language => {
    const localePage = generatePage(true, language)
    const regexp = new RegExp("/404/?$")
    if (regexp.test(localePage.path)) {
      localePage.matchPath = `/${language}/*`
    }
    createPage(localePage)
  })
}

exports.onPreInit = () => {
  console.log("Loading Plugin 'Gatsby-Plugin-Intl'")
}
