import {should, suite, test} from '../utility';
import {expect} from 'chai';

should;
@suite class BasicCommandUnitTests {
    before() {
    }

    @test 'placeholder'() {
        expect('test').to.equal('test');
    }
}