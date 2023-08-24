import User from '../src/models/user';
import { BigNumber } from 'ethers';
import { NotificationID } from '../src/jobs/mailer/NotifierService';
import {
  AssetRegistry,
  BadgeManager,
  Core,
  DisputeManager,
  FeePool,
  LPPool,
  MarketCore,
  MediatorManager,
  Token,
  TokenPool,
} from '../typechain';
import Market from '../src/models/market';
import Swap from '../src/models/swap';
import Liquidity from '../src/models/liquidity';
import Dispute from '../src/models/dispute';
import { commify, formatEther } from 'ethers/lib/utils';
import Ticket from '../src/models/ticket';
import Offer from '../src/models/offer';

declare global {
  namespace CoinGecko {
    export interface Asset {
      id: string;
      symbol: string;
      name: string;
      asset_platform_id: string;
      platforms: Platforms;
      detail_platforms: DetailPlatforms;
      block_time_in_minutes: number;
      hashing_algorithm: any;
      categories: string[];
      public_notice: any;
      additional_notices: any[];
      localization: Localization;
      description: Description;
      links: Links;
      image: Image;
      country_origin: string;
      genesis_date: any;
      contract_address: string;
      sentiment_votes_up_percentage: number;
      sentiment_votes_down_percentage: number;
      market_cap_rank: number;
      coingecko_rank: number;
      coingecko_score: number;
      developer_score: number;
      community_score: number;
      liquidity_score: number;
      public_interest_score: number;
      market_data: MarketData;
      community_data: CommunityData;
      developer_data: DeveloperData;
      public_interest_stats: PublicInterestStats;
      status_updates: any[];
      last_updated: string;
      tickers: Ticker[];
    }

    export interface Platforms {
      [key: string]: string;
    }

    export interface DetailPlatforms {
      [key: string]: {
        decimal_place: number;
        contract_address: string;
      };
    }

    export interface Localization {
      [key: string]: string;
    }

    export interface Description {
      [key: string]: string;
    }

    export interface Links {
      homepage: string[];
      blockchain_site: string[];
      official_forum_url: string[];
      chat_url: string[];
      announcement_url: string[];
      twitter_screen_name: string;
      facebook_username: string;
      bitcointalk_thread_identifier: any;
      telegram_channel_identifier: string;
      subreddit_url: any;
      repos_url: ReposUrl;
    }

    export interface ReposUrl {
      github: any[];
      bitbucket: any[];
    }

    export interface Image {
      thumb: string;
      small: string;
      large: string;
    }

    export interface MarketData {
      current_price: CurrentPrice;
      total_value_locked: any;
      mcap_to_tvl_ratio: any;
      fdv_to_tvl_ratio: any;
      roi: any;
      ath: Ath;
      ath_change_percentage: AthChangePercentage;
      ath_date: AthDate;
      atl: Atl;
      atl_change_percentage: AtlChangePercentage;
      atl_date: AtlDate;
      market_cap: MarketCap;
      market_cap_rank: number;
      fully_diluted_valuation: FullyDilutedValuation;
      total_volume: TotalVolume;
      high_24h: High24h;
      low_24h: Low24h;
      price_change_24h: number;
      price_change_percentage_24h: number;
      price_change_percentage_7d: number;
      price_change_percentage_14d: number;
      price_change_percentage_30d: number;
      price_change_percentage_60d: number;
      price_change_percentage_200d: number;
      price_change_percentage_1y: number;
      market_cap_change_24h: number;
      market_cap_change_percentage_24h: number;
      price_change_24h_in_currency: PriceChange24hInCurrency;
      price_change_percentage_1h_in_currency: PriceChangePercentage1hInCurrency;
      price_change_percentage_24h_in_currency: PriceChangePercentage24hInCurrency;
      price_change_percentage_7d_in_currency: PriceChangePercentage7dInCurrency;
      price_change_percentage_14d_in_currency: PriceChangePercentage14dInCurrency;
      price_change_percentage_30d_in_currency: PriceChangePercentage30dInCurrency;
      price_change_percentage_60d_in_currency: PriceChangePercentage60dInCurrency;
      price_change_percentage_200d_in_currency: PriceChangePercentage200dInCurrency;
      price_change_percentage_1y_in_currency: PriceChangePercentage1yInCurrency;
      market_cap_change_24h_in_currency: MarketCapChange24hInCurrency;
      market_cap_change_percentage_24h_in_currency: MarketCapChangePercentage24hInCurrency;
      total_supply: number;
      max_supply: any;
      circulating_supply: number;
      last_updated: string;
    }

    export interface CurrentPrice {
      aed: number;
      ars: number;
      aud: number;
      bch: number;
      bdt: number;
      bhd: number;
      bmd: number;
      bnb: number;
      brl: number;
      btc: number;
      cad: number;
      chf: number;
      clp: number;
      cny: number;
      czk: number;
      dkk: number;
      dot: number;
      eos: number;
      eth: number;
      eur: number;
      gbp: number;
      hkd: number;
      huf: number;
      idr: number;
      ils: number;
      inr: number;
      jpy: number;
      krw: number;
      kwd: number;
      lkr: number;
      ltc: number;
      mmk: number;
      mxn: number;
      myr: number;
      ngn: number;
      nok: number;
      nzd: number;
      php: number;
      pkr: number;
      pln: number;
      rub: number;
      sar: number;
      sek: number;
      sgd: number;
      thb: number;
      try: number;
      twd: number;
      uah: number;
      usd: number;
      vef: number;
      vnd: number;
      xag: number;
      xau: number;
      xdr: number;
      xlm: number;
      xrp: number;
      yfi: number;
      zar: number;
      bits: number;
      link: number;
      sats: number;
    }

    export interface Ath {
      aed: number;
      ars: number;
      aud: number;
      bch: number;
      bdt: number;
      bhd: number;
      bmd: number;
      bnb: number;
      brl: number;
      btc: number;
      cad: number;
      chf: number;
      clp: number;
      cny: number;
      czk: number;
      dkk: number;
      dot: number;
      eos: number;
      eth: number;
      eur: number;
      gbp: number;
      hkd: number;
      huf: number;
      idr: number;
      ils: number;
      inr: number;
      jpy: number;
      krw: number;
      kwd: number;
      lkr: number;
      ltc: number;
      mmk: number;
      mxn: number;
      myr: number;
      ngn: number;
      nok: number;
      nzd: number;
      php: number;
      pkr: number;
      pln: number;
      rub: number;
      sar: number;
      sek: number;
      sgd: number;
      thb: number;
      try: number;
      twd: number;
      uah: number;
      usd: number;
      vef: number;
      vnd: number;
      xag: number;
      xau: number;
      xdr: number;
      xlm: number;
      xrp: number;
      yfi: number;
      zar: number;
      bits: number;
      link: number;
      sats: number;
    }

    export interface AthChangePercentage {
      aed: number;
      ars: number;
      aud: number;
      bch: number;
      bdt: number;
      bhd: number;
      bmd: number;
      bnb: number;
      brl: number;
      btc: number;
      cad: number;
      chf: number;
      clp: number;
      cny: number;
      czk: number;
      dkk: number;
      dot: number;
      eos: number;
      eth: number;
      eur: number;
      gbp: number;
      hkd: number;
      huf: number;
      idr: number;
      ils: number;
      inr: number;
      jpy: number;
      krw: number;
      kwd: number;
      lkr: number;
      ltc: number;
      mmk: number;
      mxn: number;
      myr: number;
      ngn: number;
      nok: number;
      nzd: number;
      php: number;
      pkr: number;
      pln: number;
      rub: number;
      sar: number;
      sek: number;
      sgd: number;
      thb: number;
      try: number;
      twd: number;
      uah: number;
      usd: number;
      vef: number;
      vnd: number;
      xag: number;
      xau: number;
      xdr: number;
      xlm: number;
      xrp: number;
      yfi: number;
      zar: number;
      bits: number;
      link: number;
      sats: number;
    }

    export interface AthDate {
      aed: string;
      ars: string;
      aud: string;
      bch: string;
      bdt: string;
      bhd: string;
      bmd: string;
      bnb: string;
      brl: string;
      btc: string;
      cad: string;
      chf: string;
      clp: string;
      cny: string;
      czk: string;
      dkk: string;
      dot: string;
      eos: string;
      eth: string;
      eur: string;
      gbp: string;
      hkd: string;
      huf: string;
      idr: string;
      ils: string;
      inr: string;
      jpy: string;
      krw: string;
      kwd: string;
      lkr: string;
      ltc: string;
      mmk: string;
      mxn: string;
      myr: string;
      ngn: string;
      nok: string;
      nzd: string;
      php: string;
      pkr: string;
      pln: string;
      rub: string;
      sar: string;
      sek: string;
      sgd: string;
      thb: string;
      try: string;
      twd: string;
      uah: string;
      usd: string;
      vef: string;
      vnd: string;
      xag: string;
      xau: string;
      xdr: string;
      xlm: string;
      xrp: string;
      yfi: string;
      zar: string;
      bits: string;
      link: string;
      sats: string;
    }

    export interface Atl {
      aed: number;
      ars: number;
      aud: number;
      bch: number;
      bdt: number;
      bhd: number;
      bmd: number;
      bnb: number;
      brl: number;
      btc: number;
      cad: number;
      chf: number;
      clp: number;
      cny: number;
      czk: number;
      dkk: number;
      dot: number;
      eos: number;
      eth: number;
      eur: number;
      gbp: number;
      hkd: number;
      huf: number;
      idr: number;
      ils: number;
      inr: number;
      jpy: number;
      krw: number;
      kwd: number;
      lkr: number;
      ltc: number;
      mmk: number;
      mxn: number;
      myr: number;
      ngn: number;
      nok: number;
      nzd: number;
      php: number;
      pkr: number;
      pln: number;
      rub: number;
      sar: number;
      sek: number;
      sgd: number;
      thb: number;
      try: number;
      twd: number;
      uah: number;
      usd: number;
      vef: number;
      vnd: number;
      xag: number;
      xau: number;
      xdr: number;
      xlm: number;
      xrp: number;
      yfi: number;
      zar: number;
      bits: number;
      link: number;
      sats: number;
    }

    export interface AtlChangePercentage {
      aed: number;
      ars: number;
      aud: number;
      bch: number;
      bdt: number;
      bhd: number;
      bmd: number;
      bnb: number;
      brl: number;
      btc: number;
      cad: number;
      chf: number;
      clp: number;
      cny: number;
      czk: number;
      dkk: number;
      dot: number;
      eos: number;
      eth: number;
      eur: number;
      gbp: number;
      hkd: number;
      huf: number;
      idr: number;
      ils: number;
      inr: number;
      jpy: number;
      krw: number;
      kwd: number;
      lkr: number;
      ltc: number;
      mmk: number;
      mxn: number;
      myr: number;
      ngn: number;
      nok: number;
      nzd: number;
      php: number;
      pkr: number;
      pln: number;
      rub: number;
      sar: number;
      sek: number;
      sgd: number;
      thb: number;
      try: number;
      twd: number;
      uah: number;
      usd: number;
      vef: number;
      vnd: number;
      xag: number;
      xau: number;
      xdr: number;
      xlm: number;
      xrp: number;
      yfi: number;
      zar: number;
      bits: number;
      link: number;
      sats: number;
    }

    export interface AtlDate {
      aed: string;
      ars: string;
      aud: string;
      bch: string;
      bdt: string;
      bhd: string;
      bmd: string;
      bnb: string;
      brl: string;
      btc: string;
      cad: string;
      chf: string;
      clp: string;
      cny: string;
      czk: string;
      dkk: string;
      dot: string;
      eos: string;
      eth: string;
      eur: string;
      gbp: string;
      hkd: string;
      huf: string;
      idr: string;
      ils: string;
      inr: string;
      jpy: string;
      krw: string;
      kwd: string;
      lkr: string;
      ltc: string;
      mmk: string;
      mxn: string;
      myr: string;
      ngn: string;
      nok: string;
      nzd: string;
      php: string;
      pkr: string;
      pln: string;
      rub: string;
      sar: string;
      sek: string;
      sgd: string;
      thb: string;
      try: string;
      twd: string;
      uah: string;
      usd: string;
      vef: string;
      vnd: string;
      xag: string;
      xau: string;
      xdr: string;
      xlm: string;
      xrp: string;
      yfi: string;
      zar: string;
      bits: string;
      link: string;
      sats: string;
    }

    export interface MarketCap {
      aed: number;
      ars: number;
      aud: number;
      bch: number;
      bdt: number;
      bhd: number;
      bmd: number;
      bnb: number;
      brl: number;
      btc: number;
      cad: number;
      chf: number;
      clp: number;
      cny: number;
      czk: number;
      dkk: number;
      dot: number;
      eos: number;
      eth: number;
      eur: number;
      gbp: number;
      hkd: number;
      huf: number;
      idr: number;
      ils: number;
      inr: number;
      jpy: number;
      krw: number;
      kwd: number;
      lkr: number;
      ltc: number;
      mmk: number;
      mxn: number;
      myr: number;
      ngn: number;
      nok: number;
      nzd: number;
      php: number;
      pkr: number;
      pln: number;
      rub: number;
      sar: number;
      sek: number;
      sgd: number;
      thb: number;
      try: number;
      twd: number;
      uah: number;
      usd: number;
      vef: number;
      vnd: number;
      xag: number;
      xau: number;
      xdr: number;
      xlm: number;
      xrp: number;
      yfi: number;
      zar: number;
      bits: number;
      link: number;
      sats: number;
    }

    export interface TotalVolume {
      aed: number;
      ars: number;
      aud: number;
      bch: number;
      bdt: number;
      bhd: number;
      bmd: number;
      bnb: number;
      brl: number;
      btc: number;
      cad: number;
      chf: number;
      clp: number;
      cny: number;
      czk: number;
      dkk: number;
      dot: number;
      eos: number;
      eth: number;
      eur: number;
      gbp: number;
      hkd: number;
      huf: number;
      idr: number;
      ils: number;
      inr: number;
      jpy: number;
      krw: number;
      kwd: number;
      lkr: number;
      ltc: number;
      mmk: number;
      mxn: number;
      myr: number;
      ngn: number;
      nok: number;
      nzd: number;
      php: number;
      pkr: number;
      pln: number;
      rub: number;
      sar: number;
      sek: number;
      sgd: number;
      thb: number;
      try: number;
      twd: number;
      uah: number;
      usd: number;
      vef: number;
      vnd: number;
      xag: number;
      xau: number;
      xdr: number;
      xlm: number;
      xrp: number;
      yfi: number;
      zar: number;
      bits: number;
      link: number;
      sats: number;
    }

    export interface High24h {
      aed: number;
      ars: number;
      aud: number;
      bch: number;
      bdt: number;
      bhd: number;
      bmd: number;
      bnb: number;
      brl: number;
      btc: number;
      cad: number;
      chf: number;
      clp: number;
      cny: number;
      czk: number;
      dkk: number;
      dot: number;
      eos: number;
      eth: number;
      eur: number;
      gbp: number;
      hkd: number;
      huf: number;
      idr: number;
      ils: number;
      inr: number;
      jpy: number;
      krw: number;
      kwd: number;
      lkr: number;
      ltc: number;
      mmk: number;
      mxn: number;
      myr: number;
      ngn: number;
      nok: number;
      nzd: number;
      php: number;
      pkr: number;
      pln: number;
      rub: number;
      sar: number;
      sek: number;
      sgd: number;
      thb: number;
      try: number;
      twd: number;
      uah: number;
      usd: number;
      vef: number;
      vnd: number;
      xag: number;
      xau: number;
      xdr: number;
      xlm: number;
      xrp: number;
      yfi: number;
      zar: number;
      bits: number;
      link: number;
      sats: number;
    }

    export interface Low24h {
      aed: number;
      ars: number;
      aud: number;
      bch: number;
      bdt: number;
      bhd: number;
      bmd: number;
      bnb: number;
      brl: number;
      btc: number;
      cad: number;
      chf: number;
      clp: number;
      cny: number;
      czk: number;
      dkk: number;
      dot: number;
      eos: number;
      eth: number;
      eur: number;
      gbp: number;
      hkd: number;
      huf: number;
      idr: number;
      ils: number;
      inr: number;
      jpy: number;
      krw: number;
      kwd: number;
      lkr: number;
      ltc: number;
      mmk: number;
      mxn: number;
      myr: number;
      ngn: number;
      nok: number;
      nzd: number;
      php: number;
      pkr: number;
      pln: number;
      rub: number;
      sar: number;
      sek: number;
      sgd: number;
      thb: number;
      try: number;
      twd: number;
      uah: number;
      usd: number;
      vef: number;
      vnd: number;
      xag: number;
      xau: number;
      xdr: number;
      xlm: number;
      xrp: number;
      yfi: number;
      zar: number;
      bits: number;
      link: number;
      sats: number;
    }

    export interface PriceChange24hInCurrency {
      aed: number;
      ars: number;
      aud: number;
      bch: number;
      bdt: number;
      bhd: number;
      bmd: number;
      bnb: number;
      brl: number;
      btc: number;
      cad: number;
      chf: number;
      clp: number;
      cny: number;
      czk: number;
      dkk: number;
      dot: number;
      eos: number;
      eth: number;
      eur: number;
      gbp: number;
      hkd: number;
      huf: number;
      idr: number;
      ils: number;
      inr: number;
      jpy: number;
      krw: number;
      kwd: number;
      lkr: number;
      ltc: number;
      mmk: number;
      mxn: number;
      myr: number;
      ngn: number;
      nok: number;
      nzd: number;
      php: number;
      pkr: number;
      pln: number;
      rub: number;
      sar: number;
      sek: number;
      sgd: number;
      thb: number;
      try: number;
      twd: number;
      uah: number;
      usd: number;
      vef: number;
      vnd: number;
      xag: number;
      xau: number;
      xdr: number;
      xlm: number;
      xrp: number;
      yfi: number;
      zar: number;
      bits: number;
      link: number;
      sats: number;
    }

    export interface PriceChangePercentage1hInCurrency {
      aed: number;
      ars: number;
      aud: number;
      bch: number;
      bdt: number;
      bhd: number;
      bmd: number;
      bnb: number;
      brl: number;
      btc: number;
      cad: number;
      chf: number;
      clp: number;
      cny: number;
      czk: number;
      dkk: number;
      dot: number;
      eos: number;
      eth: number;
      eur: number;
      gbp: number;
      hkd: number;
      huf: number;
      idr: number;
      ils: number;
      inr: number;
      jpy: number;
      krw: number;
      kwd: number;
      lkr: number;
      ltc: number;
      mmk: number;
      mxn: number;
      myr: number;
      ngn: number;
      nok: number;
      nzd: number;
      php: number;
      pkr: number;
      pln: number;
      rub: number;
      sar: number;
      sek: number;
      sgd: number;
      thb: number;
      try: number;
      twd: number;
      uah: number;
      usd: number;
      vef: number;
      vnd: number;
      xag: number;
      xau: number;
      xdr: number;
      xlm: number;
      xrp: number;
      yfi: number;
      zar: number;
      bits: number;
      link: number;
      sats: number;
    }

    export interface PriceChangePercentage24hInCurrency {
      aed: number;
      ars: number;
      aud: number;
      bch: number;
      bdt: number;
      bhd: number;
      bmd: number;
      bnb: number;
      brl: number;
      btc: number;
      cad: number;
      chf: number;
      clp: number;
      cny: number;
      czk: number;
      dkk: number;
      dot: number;
      eos: number;
      eth: number;
      eur: number;
      gbp: number;
      hkd: number;
      huf: number;
      idr: number;
      ils: number;
      inr: number;
      jpy: number;
      krw: number;
      kwd: number;
      lkr: number;
      ltc: number;
      mmk: number;
      mxn: number;
      myr: number;
      ngn: number;
      nok: number;
      nzd: number;
      php: number;
      pkr: number;
      pln: number;
      rub: number;
      sar: number;
      sek: number;
      sgd: number;
      thb: number;
      try: number;
      twd: number;
      uah: number;
      usd: number;
      vef: number;
      vnd: number;
      xag: number;
      xau: number;
      xdr: number;
      xlm: number;
      xrp: number;
      yfi: number;
      zar: number;
      bits: number;
      link: number;
      sats: number;
    }

    export interface PriceChangePercentage7dInCurrency {
      aed: number;
      ars: number;
      aud: number;
      bch: number;
      bdt: number;
      bhd: number;
      bmd: number;
      bnb: number;
      brl: number;
      btc: number;
      cad: number;
      chf: number;
      clp: number;
      cny: number;
      czk: number;
      dkk: number;
      dot: number;
      eos: number;
      eth: number;
      eur: number;
      gbp: number;
      hkd: number;
      huf: number;
      idr: number;
      ils: number;
      inr: number;
      jpy: number;
      krw: number;
      kwd: number;
      lkr: number;
      ltc: number;
      mmk: number;
      mxn: number;
      myr: number;
      ngn: number;
      nok: number;
      nzd: number;
      php: number;
      pkr: number;
      pln: number;
      rub: number;
      sar: number;
      sek: number;
      sgd: number;
      thb: number;
      try: number;
      twd: number;
      uah: number;
      usd: number;
      vef: number;
      vnd: number;
      xag: number;
      xau: number;
      xdr: number;
      xlm: number;
      xrp: number;
      yfi: number;
      zar: number;
      bits: number;
      link: number;
      sats: number;
    }

    export interface PriceChangePercentage14dInCurrency {
      aed: number;
      ars: number;
      aud: number;
      bch: number;
      bdt: number;
      bhd: number;
      bmd: number;
      bnb: number;
      brl: number;
      btc: number;
      cad: number;
      chf: number;
      clp: number;
      cny: number;
      czk: number;
      dkk: number;
      dot: number;
      eos: number;
      eth: number;
      eur: number;
      gbp: number;
      hkd: number;
      huf: number;
      idr: number;
      ils: number;
      inr: number;
      jpy: number;
      krw: number;
      kwd: number;
      lkr: number;
      ltc: number;
      mmk: number;
      mxn: number;
      myr: number;
      ngn: number;
      nok: number;
      nzd: number;
      php: number;
      pkr: number;
      pln: number;
      rub: number;
      sar: number;
      sek: number;
      sgd: number;
      thb: number;
      try: number;
      twd: number;
      uah: number;
      usd: number;
      vef: number;
      vnd: number;
      xag: number;
      xau: number;
      xdr: number;
      xlm: number;
      xrp: number;
      yfi: number;
      zar: number;
      bits: number;
      link: number;
      sats: number;
    }

    export interface PriceChangePercentage30dInCurrency {
      aed: number;
      ars: number;
      aud: number;
      bch: number;
      bdt: number;
      bhd: number;
      bmd: number;
      bnb: number;
      brl: number;
      btc: number;
      cad: number;
      chf: number;
      clp: number;
      cny: number;
      czk: number;
      dkk: number;
      dot: number;
      eos: number;
      eth: number;
      eur: number;
      gbp: number;
      hkd: number;
      huf: number;
      idr: number;
      ils: number;
      inr: number;
      jpy: number;
      krw: number;
      kwd: number;
      lkr: number;
      ltc: number;
      mmk: number;
      mxn: number;
      myr: number;
      ngn: number;
      nok: number;
      nzd: number;
      php: number;
      pkr: number;
      pln: number;
      rub: number;
      sar: number;
      sek: number;
      sgd: number;
      thb: number;
      try: number;
      twd: number;
      uah: number;
      usd: number;
      vef: number;
      vnd: number;
      xag: number;
      xau: number;
      xdr: number;
      xlm: number;
      xrp: number;
      yfi: number;
      zar: number;
      bits: number;
      link: number;
      sats: number;
    }

    export interface PriceChangePercentage60dInCurrency {
      aed: number;
      ars: number;
      aud: number;
      bch: number;
      bdt: number;
      bhd: number;
      bmd: number;
      bnb: number;
      brl: number;
      btc: number;
      cad: number;
      chf: number;
      clp: number;
      cny: number;
      czk: number;
      dkk: number;
      dot: number;
      eos: number;
      eth: number;
      eur: number;
      gbp: number;
      hkd: number;
      huf: number;
      idr: number;
      ils: number;
      inr: number;
      jpy: number;
      krw: number;
      kwd: number;
      lkr: number;
      ltc: number;
      mmk: number;
      mxn: number;
      myr: number;
      ngn: number;
      nok: number;
      nzd: number;
      php: number;
      pkr: number;
      pln: number;
      rub: number;
      sar: number;
      sek: number;
      sgd: number;
      thb: number;
      try: number;
      twd: number;
      uah: number;
      usd: number;
      vef: number;
      vnd: number;
      xag: number;
      xau: number;
      xdr: number;
      xlm: number;
      xrp: number;
      yfi: number;
      zar: number;
      bits: number;
      link: number;
      sats: number;
    }

    export interface PriceChangePercentage200dInCurrency {
      aed: number;
      ars: number;
      aud: number;
      bch: number;
      bdt: number;
      bhd: number;
      bmd: number;
      bnb: number;
      brl: number;
      btc: number;
      cad: number;
      chf: number;
      clp: number;
      cny: number;
      czk: number;
      dkk: number;
      dot: number;
      eos: number;
      eth: number;
      eur: number;
      gbp: number;
      hkd: number;
      huf: number;
      idr: number;
      ils: number;
      inr: number;
      jpy: number;
      krw: number;
      kwd: number;
      lkr: number;
      ltc: number;
      mmk: number;
      mxn: number;
      myr: number;
      ngn: number;
      nok: number;
      nzd: number;
      php: number;
      pkr: number;
      pln: number;
      rub: number;
      sar: number;
      sek: number;
      sgd: number;
      thb: number;
      try: number;
      twd: number;
      uah: number;
      usd: number;
      vef: number;
      vnd: number;
      xag: number;
      xau: number;
      xdr: number;
      xlm: number;
      xrp: number;
      yfi: number;
      zar: number;
      bits: number;
      link: number;
      sats: number;
    }

    export interface PriceChangePercentage1yInCurrency {
      aed: number;
      ars: number;
      aud: number;
      bch: number;
      bdt: number;
      bhd: number;
      bmd: number;
      bnb: number;
      brl: number;
      btc: number;
      cad: number;
      chf: number;
      clp: number;
      cny: number;
      czk: number;
      dkk: number;
      dot: number;
      eos: number;
      eth: number;
      eur: number;
      gbp: number;
      hkd: number;
      huf: number;
      idr: number;
      ils: number;
      inr: number;
      jpy: number;
      krw: number;
      kwd: number;
      lkr: number;
      ltc: number;
      mmk: number;
      mxn: number;
      myr: number;
      ngn: number;
      nok: number;
      nzd: number;
      php: number;
      pkr: number;
      pln: number;
      rub: number;
      sar: number;
      sek: number;
      sgd: number;
      thb: number;
      try: number;
      twd: number;
      uah: number;
      usd: number;
      vef: number;
      vnd: number;
      xag: number;
      xau: number;
      xdr: number;
      xlm: number;
      xrp: number;
      yfi: number;
      zar: number;
      bits: number;
      link: number;
      sats: number;
    }

    export interface MarketCapChange24hInCurrency {
      aed: number;
      ars: number;
      aud: number;
      bch: number;
      bdt: number;
      bhd: number;
      bmd: number;
      bnb: number;
      brl: number;
      btc: number;
      cad: number;
      chf: number;
      clp: number;
      cny: number;
      czk: number;
      dkk: number;
      dot: number;
      eos: number;
      eth: number;
      eur: number;
      gbp: number;
      hkd: number;
      huf: number;
      idr: number;
      ils: number;
      inr: number;
      jpy: number;
      krw: number;
      kwd: number;
      lkr: number;
      ltc: number;
      mmk: number;
      mxn: number;
      myr: number;
      ngn: number;
      nok: number;
      nzd: number;
      php: number;
      pkr: number;
      pln: number;
      rub: number;
      sar: number;
      sek: number;
      sgd: number;
      thb: number;
      try: number;
      twd: number;
      uah: number;
      usd: number;
      vef: number;
      vnd: number;
      xag: number;
      xau: number;
      xdr: number;
      xlm: number;
      xrp: number;
      yfi: number;
      zar: number;
      bits: number;
      link: number;
      sats: number;
    }

    export interface MarketCapChangePercentage24hInCurrency {
      aed: number;
      ars: number;
      aud: number;
      bch: number;
      bdt: number;
      bhd: number;
      bmd: number;
      bnb: number;
      brl: number;
      btc: number;
      cad: number;
      chf: number;
      clp: number;
      cny: number;
      czk: number;
      dkk: number;
      dot: number;
      eos: number;
      eth: number;
      eur: number;
      gbp: number;
      hkd: number;
      huf: number;
      idr: number;
      ils: number;
      inr: number;
      jpy: number;
      krw: number;
      kwd: number;
      lkr: number;
      ltc: number;
      mmk: number;
      mxn: number;
      myr: number;
      ngn: number;
      nok: number;
      nzd: number;
      php: number;
      pkr: number;
      pln: number;
      rub: number;
      sar: number;
      sek: number;
      sgd: number;
      thb: number;
      try: number;
      twd: number;
      uah: number;
      usd: number;
      vef: number;
      vnd: number;
      xag: number;
      xau: number;
      xdr: number;
      xlm: number;
      xrp: number;
      yfi: number;
      zar: number;
      bits: number;
      link: number;
      sats: number;
    }

    export interface CommunityData {
      facebook_likes: any;
      twitter_followers: number;
      reddit_average_posts_48h: number;
      reddit_average_comments_48h: number;
      reddit_subscribers: number;
      reddit_accounts_active_48h: number;
      telegram_channel_user_count: any;
    }

    export interface DeveloperData {
      forks: number;
      stars: number;
      subscribers: number;
      total_issues: number;
      closed_issues: number;
      pull_requests_merged: number;
      pull_request_contributors: number;
      code_additions_deletions_4_weeks: CodeAdditionsDeletions4Weeks;
      commit_count_4_weeks: number;
      last_4_weeks_commit_activity_series: any[];
    }

    export interface CodeAdditionsDeletions4Weeks {
      additions: any;
      deletions: any;
    }

    export interface PublicInterestStats {
      alexa_rank: number;
      bing_matches: any;
    }

    export interface Ticker {
      base: string;
      target: string;
      market: Market;
      last: number;
      volume: number;
      converted_last: ConvertedLast;
      converted_volume: ConvertedVolume;
      trust_score: string;
      bid_ask_spread_percentage: number;
      timestamp: string;
      last_traded_at: string;
      last_fetch_at: string;
      is_anomaly: boolean;
      is_stale: boolean;
      trade_url?: string;
      token_info_url: any;
      coin_id: string;
      target_coin_id?: string;
    }

    export interface Market {
      name: string;
      identifier: string;
      has_trading_incentive: boolean;
    }

    export interface ConvertedLast {
      btc: number;
      eth: number;
      usd: number;
    }

    export interface ConvertedVolume {
      btc: number;
      eth: number;
      usd: number;
    }
  }

  namespace Express {
    export interface Request {
      user: User;
      parsedRawBody: Buffer;
    }
  }

  interface OKResponse {
    ok: boolean;
  }

  interface CountResponse {
    count: string;
  }

  interface AnObject {
    [key: string]: any;
  }

  interface JointContracts {
    p2pToken?: Token;
    marketCore?: MarketCore;
    core?: Core;
    mediatorMgr?: MediatorManager;
    disputeMgr?: DisputeManager;
    badgeMgr?: BadgeManager;
    tokenPool?: TokenPool;
    lpPool?: LPPool;
    feePool?: FeePool;
    assetRegistry?: AssetRegistry;
  }

  interface ContractMarket {
    creator: string;
    createdAt: BigNumber;
    baseAsset: {
      addr: string;
      isLocal: boolean;
    };
    quoteAsset: {
      addr: string;
      isLocal: boolean;
    };
    numDisputes: BigNumber;
    permPut?: boolean;
    permSwap?: boolean;
    permMediate?: boolean;
    commission: BigNumber;
    numMediators?: BigNumber;
    mediatorBond?: BigNumber;
  }

  interface ContractLiquidity {
    amount: BigNumber;
    price: BigNumber;
    minSwap: BigNumber;
    maxSwap: BigNumber;
    timeToPay: BigNumber;
    openOrders: BigNumber;
    paused: boolean;
  }

  interface NotifyJob<T> {
    notifType: NotificationID;
    network: string;
    recipient: string;
    appUrl: string;
    user?: User;
    data: T;
  }

  interface TokenMetadata {
    logoURI: string;
    network: string;
    name: string;
    decimals: number;
    price?: number;
    isContract?: boolean;
  }

  interface SignatureData {
    address: string;
    email: string;
  }

  interface AssetStat {
    symbol?: string;
    address?: string;
    volume24h?: string;
    price24h?: number;
    lowestPrice24h?: string;
    highestPrice24h?: string;
    network?: string;
    dominantColor?: string;
  }

  namespace TokenList {
    interface TokenData {
      name: string;
      logoURI: string;
      timestamp: string;
      tokens: Token[];
      version: Version;
    }

    interface Token {
      asset?: string;
      type?: string;
      address?: string;
      name?: string;
      symbol?: string;
      decimals?: number;
      logoURI?: string;
      price?: number; // Used in dev mode only
      isSynthetic?: boolean; // Used to identify synthetic tokens
    }

    interface Version {
      major: number;
      minor: number;
      patch: number;
    }
  }

  interface ContractsParams {
    // Core params
    minTimeToPay: number;
    orderGraceDur: number;
    maxOpenOrders: number;
    maxOpenDisputes: number;
    transferToFeePoolInterval: number;
    nftDiscountBP: number;

    // Market manager params
    baseTicketPrice: number;
    ticketWindowDur: number;
    ticketsPerWindow: number;
    ticketSupply: number;
    priceSupplyDeltaBP: number;
    minInactiveWindowBeforeReset: number;
    soldOutBP: number;
    ticketMatureDur: number;
    ticketCancelDur: number;
    ticketExpireDur: number;
    noVoteSlashBP: number;
    loseVoteSlashBP: number;

    // Dispute manager params
    rewardWindowAlloc: BigNumber;
    rewardWindowDur: number;
    redeemWindowRewardDur: number;
    predictDur: number;
    appealDur: number;
    evidenceDur: number;
    disputeCost: number;
    maxMediatorPerDispute: number;

    // Chainlink params
    chainlinkKeyHash: string;
    chainlinkCoordinator: string;
    chainlinkSubId: number;

    // Operator params
    operatorBond: BigNumber;

    // Others
    safe: string;
    allocatorAddr: string;
  }

  export interface InstantSwapNotificationData {
    market: Market;
    swap: Partial<Swap>;
    liq: Liquidity;
  }

  export interface SwapOrderNotificationData {
    marketAddress: string;
    provider: string;
    swapper: string;
    swap: Partial<Swap>;
    market: Market;
  }

  interface CancelledOrderNotification {
    market: Market;
    liq: Liquidity;
    swap: Swap;
  }

  interface OrderReleasedNotification {
    market: Market;
    liq: Liquidity;
    swap: Swap;
  }

  interface OrderPaidNotification {
    swap: Swap;
    market: Market;
  }

  interface MediatorInviteReceivedNotification {
    market: Market;
  }

  interface MediatorInviteAcceptedNotification {
    market: Market;
    invitee: string;
  }

  interface MediatorRevokedNotification {
    market: Market;
  }

  interface PutApprovedNotification {
    market: Market;
  }

  interface PutRevokedNotification {
    market: Market;
  }

  interface SwapApprovedNotification {
    market: Market;
  }

  interface SwapRevokedNotification {
    market: Market;
  }

  interface UpdatedLiquidityManagerNotification {
    market: Market;
    provider: string;
  }

  interface RemoveLiquidityManagerNotification {
    market: Market;
    provider: string;
  }

  interface NewTicketJoinedPoolNotification {
    market: Market;
    owner: string;
    numTickets: string;
  }

  interface NewTicketLeftMarketNotification {
    market: Market;
    owner: string;
    numTickets: string;
  }

  interface DisputeCreatedNotification {
    dispute: Dispute;
    swap: Swap;
  }

  interface TicketDraftedNotification {
    owner: string;
    ticketId: number;
    dispute: Dispute;
  }

  interface FullyDraftedNotification {
    dispute: Dispute;
    evidencePhaseHoursLeft: string;
  }

  interface TicketSlashedNotification {
    ticket: Ticket;
    owner: string;
    amount: string;
    voted: boolean;
    asset: string;
  }

  interface EvidencePeriodEndedNotification {
    swap: Swap;
    disputeId: number;
    commitPhaseHoursLeft: string;
    drafted: boolean;
  }

  interface CommitPhaseEndedNotification {
    swap: Swap;
    disputeId: number;
    drafted: boolean;
    revealPhaseHoursLeft: string;
  }

  interface RevealPhaseEndedNotification {
    swap: Swap;
    disputeId: number;
    participant: boolean;
    nRelease: number;
    nCancel: number;
    numMediators: number;
    majority: number;
    cost: string;
    appealPhaseHoursLeft: string;
  }

  interface DisputeExecutedNotification {
    swap: Swap;
    dispute: Dispute;
    drafted: boolean;
  }

  interface BaseOfferNotification {
    offer: Offer;
    market: Market;
    liq: Liquidity;
  }

  interface NewUpdatedOfferNotification extends BaseOfferNotification {
    updated: boolean;
  }

  interface PoolParams {
    poolId: number;
    reqBond: string;
    draftReward: string;
    winReward: string;
    noVoteSlashBP: string;
    loseVoteSlashBP: string;
    numDraftees: number;
  }
}
