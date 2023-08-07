import * as handlebars from "handlebars";
import * as HandlebarHelpers from "handlebars-helpers";

// primaryButton is the component for primary buttons
handlebars.registerPartial(
  'primaryButton',
  '<a href="{{btnLink}}" style="background-color: #C8ED5A; padding: 10px; display: block; border-radius: 20px; margin-bottom: 10px; text-align: center; color: #000000; text-decoration: none; font-weight: bold;">{{btnValue}}</a>',
);

// badgeSuccess is the component for success badges
// used within a alertStyle-ed component
handlebars.registerPartial(
  'badgeInfo',
  `<span style="display: inline; background-color: #f8f8f8; padding: 2px 10px; border-radius: 40px; color: #9cba46; font-weight: bold; border: 1px solid #caed60;">{{label}}</span>`,
);

// badgeSuccess is the component for success badges
// used within a alertStyle-ed component
handlebars.registerPartial(
  'badgeDanger',
  `<span style="display: inline; background-color: red; padding: 2px 10px; border-radius: 40px; color: #ffffff; font-weight: bold; border: 1px solid #df1212;">{{label}}</span>`,
);

// alertStyle is the style for alert messages
handlebars.registerPartial(
  'alertStyle',
  `style="background-color: #efefef; border-left: 4px solid #C8ED5A; border-right: 4px solid #C8ED5A;  border-radius: 10px; font-size: 15px; font-family: Courier,serif"`,
);

// printTokenIDs prints NFT token IDs as a comma separated list
handlebars.registerPartial('printTokenIDs', (context: { ids: number[] }, options) => {
  return context.ids.map((id) => `#${id}`).join(', ');
});

HandlebarHelpers({ handlebars });
