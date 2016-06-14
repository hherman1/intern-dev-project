import * as React from "react";
import * as _ from "lodash";

import {
	SearchkitManager, SearchkitProvider,
	SearchBox, RefinementListFilter, MenuFilter,
	Hits, HitsStats, NoHits, Pagination, SortingSelector,
	SelectedFilters, ResetFilters, ItemHistogramList,
	Layout, LayoutBody, LayoutResults, TopBar,
	SideBar, ActionBar, ActionBarRow
} from "searchkit";

require("./index.scss");

const host = "http://search-dev-task-search-cluster-ric5clhuvao44dtnhhhlnje7o4.us-west-2.es.amazonaws.com"

//const host = "http://demo.searchkit.co/api/movies"
const searchkit = new SearchkitManager(host)

const MovieHitsGridItem = (props)=> {
  const {bemBlocks, result} = props
  const source:any = _.extend({}, result._source, result.highlight)
  let url = "https://s3-us-west-2.amazonaws.com/" 
          + encodeURIComponent(source.Bucket) 
          + "/" 
          + encodeURIComponent(source.Key)
  return (<div> <a href={url}> {source.Key}</a></div>);
/*  return (
    <div className={bemBlocks.item().mix(bemBlocks.container("item"))} data-qa="hit">
      <a href={url} target="_blank">
        <img data-qa="poster" className={bemBlocks.item("poster")} src={result._source.poster} width="170" height="240"/>
        <div data-qa="title" className={bemBlocks.item("title")} dangerouslySetInnerHTML={{__html:source.title}}>
        </div>
      </a>
    </div>
  )
  */
}

export class SearchPage extends React.Component {
	render(){
		return (
			<SearchkitProvider searchkit={searchkit}>
		    <Layout>
		      <TopBar>
		        <SearchBox
		          autofocus={true}
		          searchOnChange={true}
							placeholder="Search documents..."
		          prefixQueryFields={["Text"]}/>
		      </TopBar>
		      <LayoutBody>
              {/*
		        <SideBar>
							<MenuFilter
								id="type"
								title="Movie Type"
								field="type.raw"
								listComponent={ItemHistogramList}/>
		          <RefinementListFilter
		            id="actors"
		            title="Actors"
		            field="actors.raw"
		            operator="AND"
		            size={10}/>
		        </SideBar>
                */}
		        <LayoutResults>
		          <ActionBar>
		            <ActionBarRow>
		              <HitsStats/>
                      {/*					<SortingSelector options={[
										{label:"Relevance", field:"_score", order:"desc", defaultOption:true},
										{label:"Latest Releases", field:"released", order:"desc"},
										{label:"Earliest Releases", field:"released", order:"asc"}
									]}/>
                                    */}
		            </ActionBarRow>
                    {/*
		            <ActionBarRow>
		              <SelectedFilters/>
		              <ResetFilters/>
		            </ActionBarRow>
                    */}
		          </ActionBar>
		          <Hits hitsPerPage={10} itemComponent={MovieHitsGridItem}
                    highlightFields={["Text"]}
		            sourceFilter={["Bucket","Key","Text"]}/>
		          <NoHits/>
							<Pagination showNumbers={true}/>
		        </LayoutResults>
		      </LayoutBody>
		    </Layout>
		  </SearchkitProvider>
		)
	}
}
