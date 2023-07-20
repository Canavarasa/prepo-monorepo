import { enumerate } from '../string-utils'

describe('string utils', () => {
  describe('enumerate', () => {
    it('should return an empty string if no elements', () => {
      expect(enumerate('Apples')).toEqual('Apples')
    })

    it('should return a single element as-is', () => {
      expect(enumerate('Apples')).toEqual('Apples')
    })

    it('should return two elements joint with "and"', () => {
      expect(enumerate('Apples', 'Bananas')).toEqual('Apples and Bananas')
    })

    it('should return three elements joint with commas and "and"', () => {
      expect(enumerate('Apples', 'Bananas', 'Carrots')).toEqual('Apples, Bananas and Carrots')
    })

    it('should return four elements joint with commas and "and"', () => {
      expect(enumerate('Apples', 'Bananas', 'Carrots', 'Dates')).toEqual(
        'Apples, Bananas, Carrots and Dates'
      )
    })
  })
})
